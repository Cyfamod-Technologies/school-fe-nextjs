'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiClient';

type QuestionType = 'mcq' | 'multiple_select' | 'true_false' | 'short_answer';
type ShortAnswerMatch = 'exact' | 'contains' | 'keywords';
type BulkImportResult = { imported: number; failed: number; errors: string[] };

interface Quiz {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'closed';
  total_questions: number;
  passing_score: number;
  duration_minutes: number;
}

interface QuizOption {
  id?: string;
  option_text: string;
  order: number;
  is_correct: boolean;
  image_url?: string | null;
}

interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  order: number;
  image_url?: string | null;
  explanation?: string | null;
  options: QuizOption[];
  short_answer_answers?: string[];
  short_answer_keywords?: string[];
  short_answer_match?: ShortAnswerMatch;
}

interface QuestionForm {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  order: number;
  image_url: string;
  explanation: string;
  options: QuizOption[];
  short_answer_answers: string[];
  short_answer_keywords: string[];
  short_answer_match: ShortAnswerMatch;
}

const questionTypeLabels: Record<QuestionType, string> = {
  mcq: 'Multiple Choice',
  multiple_select: 'Multiple Select',
  true_false: 'True / False',
  short_answer: 'Short Answer',
};

const shortAnswerMatchLabels: Record<ShortAnswerMatch, string> = {
  exact: 'Exact match',
  contains: 'Answer contains phrase',
  keywords: 'Keyword match',
};

const makeTrueFalseOptions = (existing?: QuizOption[]): QuizOption[] => {
  const trueOption = existing?.[0];
  const falseOption = existing?.[1];

  return [
    {
      id: trueOption?.id,
      option_text: 'True',
      order: 1,
      is_correct: trueOption?.is_correct ?? false,
      image_url: trueOption?.image_url ?? null,
    },
    {
      id: falseOption?.id,
      option_text: 'False',
      order: 2,
      is_correct: falseOption?.is_correct ?? false,
      image_url: falseOption?.image_url ?? null,
    },
  ];
};

const normalizeOptions = (type: QuestionType, options: QuizOption[]): QuizOption[] => {
  if (type === 'short_answer') {
    return [];
  }

  if (type === 'true_false') {
    return makeTrueFalseOptions(options);
  }

  if (options.length === 0) {
    return [
      { option_text: '', order: 1, is_correct: false },
      { option_text: '', order: 2, is_correct: false },
    ];
  }

  return options.map((option, index) => ({
    ...option,
    order: index + 1,
  }));
};

const emptyQuestionForm = (order: number): QuestionForm => ({
  question_text: '',
  question_type: 'mcq',
  marks: 1,
  order,
  image_url: '',
  explanation: '',
  options: normalizeOptions('mcq', []),
  short_answer_answers: [],
  short_answer_keywords: [],
  short_answer_match: 'exact',
});

const statusBadgeClass = (status: Quiz['status']) => {
  switch (status) {
    case 'published':
      return 'badge badge-pill badge-success';
    case 'draft':
      return 'badge badge-pill badge-warning';
    default:
      return 'badge badge-pill badge-danger';
  }
};

const parseShortAnswerList = (value: string): string[] => {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const bulkImportTemplate = [
  'question_text,question_type,marks,options,correct_answers,correct_answer,short_answer_answers,short_answer_keywords,short_answer_match,image_url,explanation',
  '"What is the capital of France?",mcq,1,"London|Paris|Berlin","2",,,,,,',
  '"Select prime numbers.",multiple_select,2,"2|3|4|5","1|2|4",,,,,,',
  '"The earth is round.",true_false,1,,,true,,,,,',
  '"2 + 2 = ?",short_answer,1,,,,"4|four","addition|math",exact,,',
].join('\n');

const validQuestionTypes: QuestionType[] = ['mcq', 'multiple_select', 'true_false', 'short_answer'];
const validShortAnswerMatches: ShortAnswerMatch[] = ['exact', 'contains', 'keywords'];
const csvSeparator = '|';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  }
  return null;
};

const parseListValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return parseShortAnswerList(value);
  }
  return [];
};

const normalizeCsvHeader = (header: string): string => {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const splitPipeList = (value: string): string[] => {
  return value
    .split(csvSeparator)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parseCsvRows = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim() !== '')) {
    rows.push(row);
  }

  return rows;
};

const parseBulkCsvRecords = (input: string): Record<string, string>[] => {
  const rows = parseCsvRows(input);
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one question row.');
  }

  const headers = rows[0].map(normalizeCsvHeader);
  const questionHeaderExists = headers.includes('question_text') || headers.includes('question');
  if (!questionHeaderExists) {
    throw new Error('CSV header must include question_text.');
  }

  const records: Record<string, string>[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const values = rows[rowIndex];
    const record: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      record[header] = (values[columnIndex] ?? '').trim();
    });
    if (Object.values(record).some((value) => value !== '')) {
      records.push(record);
    }
  }

  if (records.length === 0) {
    throw new Error('No question rows found in CSV.');
  }

  return records;
};

const markCorrectOptions = (options: QuizOption[], correctTokens: string[]) => {
  if (correctTokens.length === 0) return;

  const normalizedOptionMap = new Map(
    options.map((option, index) => [option.option_text.trim().toLowerCase(), index] as const),
  );

  correctTokens.forEach((token) => {
    const numericIndex = Number(token);
    if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= options.length) {
      options[numericIndex - 1].is_correct = true;
      return;
    }
    const mappedIndex = normalizedOptionMap.get(token.trim().toLowerCase());
    if (typeof mappedIndex === 'number') {
      options[mappedIndex].is_correct = true;
    }
  });
};

const buildBulkEntryFromCsvRecord = (record: Record<string, string>): Record<string, unknown> => {
  const questionText = record.question_text || record.question || '';
  const questionType = (record.question_type || record.type || 'mcq').toLowerCase().replace(/-/g, '_');
  const marks = record.marks || '1';
  const order = record.order;

  const optionsFromSingleField = splitPipeList(record.options || record.option_texts || '');
  const optionColumnValues = Object.entries(record)
    .filter(([key, value]) => key.startsWith('option_') && value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value.trim())
    .filter(Boolean);
  const optionTexts = [...optionsFromSingleField, ...optionColumnValues];

  const options = optionTexts.map((optionText, index) => ({
    option_text: optionText,
    is_correct: false,
    order: index + 1,
  }));

  markCorrectOptions(options, splitPipeList(record.correct_answers || record.correct || ''));

  const entry: Record<string, unknown> = {
    question_text: questionText,
    question_type: questionType,
    marks,
    order,
    image_url: record.image_url || '',
    explanation: record.explanation || '',
    options,
    correct_answer: record.correct_answer || record.answer || '',
    short_answer_answers: splitPipeList(record.short_answer_answers || record.accepted_answers || ''),
    short_answer_keywords: splitPipeList(record.short_answer_keywords || record.keywords || ''),
    short_answer_match: record.short_answer_match || 'exact',
  };

  return entry;
};

const parseBulkOptions = (value: unknown): QuizOption[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const optionText = entry.trim();
        if (!optionText) return null;
        return {
          option_text: optionText,
          is_correct: false,
          order: index + 1,
        } satisfies QuizOption;
      }

      if (!isRecord(entry)) return null;

      const optionTextRaw = entry.option_text;
      if (typeof optionTextRaw !== 'string' || !optionTextRaw.trim()) {
        return null;
      }

      return {
        option_text: optionTextRaw.trim(),
        is_correct: Boolean(entry.is_correct),
        order: typeof entry.order === 'number' && entry.order >= 1 ? Math.floor(entry.order) : index + 1,
        image_url: typeof entry.image_url === 'string' ? entry.image_url.trim() || null : null,
      } satisfies QuizOption;
    })
    .filter((option): option is QuizOption => option !== null)
    .map((option, index) => ({ ...option, order: index + 1 }));
};

const buildBulkQuestionPayload = (entry: unknown, defaultOrder: number): Record<string, unknown> => {
  if (!isRecord(entry)) {
    throw new Error('Each question must be a JSON object.');
  }

  const questionText = typeof entry.question_text === 'string' ? entry.question_text.trim() : '';
  if (!questionText) {
    throw new Error('question_text is required.');
  }

  const questionTypeRaw =
    typeof entry.question_type === 'string' ? entry.question_type.trim().toLowerCase().replace('-', '_') : 'mcq';
  if (!validQuestionTypes.includes(questionTypeRaw as QuestionType)) {
    throw new Error('question_type must be one of mcq, multiple_select, true_false, short_answer.');
  }
  const questionType = questionTypeRaw as QuestionType;

  const marksRaw = entry.marks ?? 1;
  const marks = Number(marksRaw);
  if (!Number.isInteger(marks) || marks < 1) {
    throw new Error('marks must be an integer greater than or equal to 1.');
  }

  const orderRaw = entry.order;
  const order =
    typeof orderRaw === 'number' && Number.isInteger(orderRaw) && orderRaw >= 1 ? orderRaw : defaultOrder;

  const payload: Record<string, unknown> = {
    question_text: questionText,
    question_type: questionType,
    marks,
    order,
    image_url: typeof entry.image_url === 'string' ? entry.image_url.trim() || null : null,
    explanation: typeof entry.explanation === 'string' ? entry.explanation.trim() || null : null,
  };

  if (questionType === 'short_answer') {
    const shortAnswerMatchRaw =
      typeof entry.short_answer_match === 'string' ? entry.short_answer_match.trim().toLowerCase() : 'exact';
    if (!validShortAnswerMatches.includes(shortAnswerMatchRaw as ShortAnswerMatch)) {
      throw new Error('short_answer_match must be one of exact, contains, keywords.');
    }
    const shortAnswerAnswers = parseListValue(entry.short_answer_answers);
    const shortAnswerKeywords = parseListValue(entry.short_answer_keywords);

    if (shortAnswerAnswers.length === 0 && shortAnswerKeywords.length === 0) {
      throw new Error('Provide short_answer_answers or short_answer_keywords for short_answer questions.');
    }

    payload.short_answer_match = shortAnswerMatchRaw;
    payload.short_answer_answers = shortAnswerAnswers;
    payload.short_answer_keywords = shortAnswerKeywords;
    return payload;
  }

  let options = parseBulkOptions(entry.options);
  if (questionType === 'true_false' && options.length === 0) {
    const correctAnswer = parseBooleanValue(entry.correct_answer);
    if (correctAnswer === null) {
      throw new Error('true_false questions require options or a boolean correct_answer.');
    }
    options = [
      { option_text: 'True', is_correct: correctAnswer, order: 1 },
      { option_text: 'False', is_correct: !correctAnswer, order: 2 },
    ];
  }

  if (options.length < 2) {
    throw new Error('At least two options are required.');
  }

  const correctCount = options.filter((option) => option.is_correct).length;
  if (correctCount === 0) {
    throw new Error('Select at least one correct option.');
  }
  if ((questionType === 'mcq' || questionType === 'true_false') && correctCount > 1) {
    throw new Error('Only one correct option is allowed for mcq/true_false.');
  }

  payload.options = options.map((option, index) => ({
    option_text: option.option_text,
    is_correct: option.is_correct,
    order: index + 1,
    image_url: option.image_url ?? null,
  }));

  return payload;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return fallback;
};

export default function QuizQuestionsPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(() => emptyQuestionForm(1));
  const [bulkInput, setBulkInput] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResult | null>(null);

  const totalQuestionCount = questions.length;
  const nextQuestionOrder = totalQuestionCount + 1;
  const isEditingQuestion = Boolean(activeQuestionId);

  const questionMismatch = useMemo(() => {
    if (!quiz) return false;
    return quiz.total_questions !== totalQuestionCount;
  }, [quiz, totalQuestionCount]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [quizRes, questionsRes] = await Promise.all([
        apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}`),
        apiFetch<{ data: QuizQuestion[] }>(
          `/api/v1/cbt/quizzes/${quizId}/questions?include_correct=1`,
        ),
      ]);

      const nextQuestions = questionsRes.data || [];
      setQuiz({
        ...quizRes.data,
        total_questions: nextQuestions.length,
      });
      setQuestions(nextQuestions);
      setActiveQuestionId(null);
      setQuestionForm(emptyQuestionForm(nextQuestions.length + 1));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load quiz questions'));
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  const refreshQuestions = async (): Promise<QuizQuestion[]> => {
    const response = await apiFetch<{ data: QuizQuestion[] }>(
      `/api/v1/cbt/quizzes/${quizId}/questions?include_correct=1`,
    );
    const nextQuestions = response.data || [];
    setQuestions(nextQuestions);
    setQuiz((prev) => (prev ? { ...prev, total_questions: nextQuestions.length } : prev));
    return nextQuestions;
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loadData();
  }, [authLoading, user, loadData]);

  const resetQuestionForm = (order: number) => {
    setActiveQuestionId(null);
    setQuestionForm(emptyQuestionForm(order));
  };

  const handleQuestionSelect = (question: QuizQuestion) => {
    setActiveQuestionId(question.id);
    setQuestionForm({
      id: question.id,
      question_text: question.question_text,
      question_type: question.question_type,
      marks: question.marks,
      order: question.order,
      image_url: question.image_url ?? '',
      explanation: question.explanation ?? '',
      options: normalizeOptions(question.question_type, question.options || []),
      short_answer_answers: question.short_answer_answers ?? [],
      short_answer_keywords: question.short_answer_keywords ?? [],
      short_answer_match: question.short_answer_match ?? 'exact',
    });
  };

  const updateQuestionType = (nextType: QuestionType) => {
    setQuestionForm((prev) => ({
      ...prev,
      question_type: nextType,
      options: normalizeOptions(nextType, prev.options),
      short_answer_match: nextType === 'short_answer' ? prev.short_answer_match || 'exact' : prev.short_answer_match,
    }));
  };

  const updateOptionText = (index: number, value: string) => {
    setQuestionForm((prev) => {
      const options = [...prev.options];
      options[index] = { ...options[index], option_text: value };
      return { ...prev, options };
    });
  };

  const updateOptionCorrect = (index: number, checked: boolean) => {
    setQuestionForm((prev) => {
      const options = prev.options.map((option, idx) => {
        if (prev.question_type === 'multiple_select') {
          return idx === index ? { ...option, is_correct: checked } : option;
        }
        return { ...option, is_correct: idx === index ? checked : false };
      });

      return { ...prev, options };
    });
  };

  const addOption = () => {
    setQuestionForm((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        {
          option_text: '',
          order: prev.options.length + 1,
          is_correct: false,
        },
      ],
    }));
  };

  const removeOption = (index: number) => {
    setQuestionForm((prev) => {
      const options = prev.options.filter((_, idx) => idx !== index);
      return { ...prev, options: normalizeOptions(prev.question_type, options) };
    });
  };

  const validateQuestion = (): string | null => {
    if (!questionForm.question_text.trim()) {
      return 'Question text is required.';
    }

    if (questionForm.marks < 1) {
      return 'Marks must be at least 1.';
    }

    if (questionForm.question_type === 'short_answer') {
      const hasAnswers = questionForm.short_answer_answers.length > 0;
      const hasKeywords = questionForm.short_answer_keywords.length > 0;
      if (!hasAnswers && !hasKeywords) {
        return 'Provide accepted answers or keywords for short answer questions.';
      }
    }

    if (questionForm.question_type !== 'short_answer') {
      const filledOptions = questionForm.options.filter((option) => option.option_text.trim());
      if (filledOptions.length < 2) {
        return 'Provide at least two options.';
      }

      const correctCount = filledOptions.filter((option) => option.is_correct).length;
      if (correctCount === 0) {
        return 'Select at least one correct option.';
      }

      if (
        (questionForm.question_type === 'mcq' || questionForm.question_type === 'true_false') &&
        correctCount > 1
      ) {
        return 'Only one correct option is allowed.';
      }
    }

    return null;
  };

  const saveQuestion = async () => {
    const validationError = validateQuestion();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSavingQuestion(true);
      setError(null);
      setSuccess(null);

      const questionPayload: Record<string, unknown> = {
        question_text: questionForm.question_text.trim(),
        question_type: questionForm.question_type,
        marks: questionForm.marks,
        order: questionForm.order,
        image_url: questionForm.image_url.trim() || null,
        explanation: questionForm.explanation.trim() || null,
      };

      if (questionForm.question_type === 'short_answer') {
        questionPayload.short_answer_match = questionForm.short_answer_match;
        questionPayload.short_answer_answers = questionForm.short_answer_answers;
        questionPayload.short_answer_keywords = questionForm.short_answer_keywords;
      }

      let questionId = questionForm.id;
      const normalizedOptions = questionForm.options
        .filter((option) => option.option_text.trim())
        .map((option, index) => ({
          ...option,
          option_text: option.option_text.trim(),
          order: index + 1,
        }));

      if (questionId) {
        await apiFetch(`/api/v1/cbt/quizzes/${quizId}/questions/${questionId}`, {
          method: 'PUT',
          body: JSON.stringify(questionPayload),
        });
      } else {
        if (questionForm.question_type !== 'short_answer') {
          questionPayload.options = normalizedOptions;
        }
        const response = await apiFetch<{ data: QuizQuestion }>(`/api/v1/cbt/quizzes/${quizId}/questions`, {
          method: 'POST',
          body: JSON.stringify(questionPayload),
        });
        questionId = response.data.id;
      }

      if (questionForm.question_type !== 'short_answer' && questionId && questionForm.id) {
        const existingOptions = questions.find((q) => q.id === questionId)?.options || [];
        const formIds = new Set(normalizedOptions.map((option) => option.id).filter(Boolean) as string[]);

        const toDelete = existingOptions.filter((option) => option.id && !formIds.has(option.id));
        const toCreate = normalizedOptions.filter((option) => !option.id);
        const toUpdate = normalizedOptions.filter((option) => option.id);

        await Promise.all(
          toDelete.map((option) =>
            apiFetch(`/api/v1/cbt/questions/${questionId}/options/${option.id}`, {
              method: 'DELETE',
            }),
          ),
        );

        await Promise.all(
          toUpdate.map((option) =>
            apiFetch(`/api/v1/cbt/questions/${questionId}/options/${option.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                option_text: option.option_text,
                order: option.order,
                is_correct: option.is_correct,
                image_url: option.image_url || null,
              }),
            }),
          ),
        );

        await Promise.all(
          toCreate.map((option) =>
            apiFetch(`/api/v1/cbt/questions/${questionId}/options`, {
              method: 'POST',
              body: JSON.stringify({
                option_text: option.option_text,
                order: option.order,
                is_correct: option.is_correct,
                image_url: option.image_url || null,
              }),
            }),
          ),
        );
      }

      const refreshedQuestions = await refreshQuestions();
      resetQuestionForm(refreshedQuestions.length + 1);
      setSuccess('Question saved successfully.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save question'));
    } finally {
      setSavingQuestion(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      setSavingQuestion(true);
      await apiFetch(`/api/v1/cbt/quizzes/${quizId}/questions/${questionId}`, {
        method: 'DELETE',
      });
      const refreshedQuestions = await refreshQuestions();
      resetQuestionForm(refreshedQuestions.length + 1);
      setSuccess('Question deleted successfully.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete question'));
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleBulkFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setBulkInput(content);
      setError(null);
      setSuccess(`Loaded ${file.name}. Review and click Import Questions.`);
      setBulkImportResult(null);
    } catch {
      setError('Unable to read file. Please use a valid CSV file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleDownloadCsvTemplate = () => {
    const blob = new Blob([bulkImportTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cbt-questions-template-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleBulkImport = async () => {
    if (!bulkInput.trim()) {
      setError('Paste CSV questions or upload a CSV file first.');
      return;
    }

    try {
      setSavingQuestion(true);
      setBulkImporting(true);
      setError(null);
      setSuccess(null);
      setBulkImportResult(null);

      const items = parseBulkCsvRecords(bulkInput).map(buildBulkEntryFromCsvRecord);
      if (items.length === 0) {
        throw new Error('No questions found in CSV payload.');
      }

      const importErrors: string[] = [];
      let imported = 0;
      let orderCursor = nextQuestionOrder;

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        try {
          const payload = buildBulkQuestionPayload(item, orderCursor);
          await apiFetch(`/api/v1/cbt/quizzes/${quizId}/questions`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          imported += 1;
          orderCursor += 1;
        } catch (itemError: unknown) {
          const questionLabel =
            isRecord(item) && typeof item.question_text === 'string' && item.question_text.trim()
              ? ` (${item.question_text.trim().slice(0, 40)})`
              : '';
          importErrors.push(`Item ${index + 1}${questionLabel}: ${getErrorMessage(itemError, 'Import failed.')}`);
        }
      }

      const refreshedQuestions = await refreshQuestions();
      resetQuestionForm(refreshedQuestions.length + 1);

      setBulkImportResult({
        imported,
        failed: importErrors.length,
        errors: importErrors,
      });

      if (imported > 0 && importErrors.length === 0) {
        setSuccess(`Imported ${imported} question${imported === 1 ? '' : 's'} successfully.`);
      } else if (imported > 0) {
        setSuccess(`Imported ${imported} question${imported === 1 ? '' : 's'} with ${importErrors.length} failure(s).`);
      } else {
        setError('Bulk import failed. Fix the errors and try again.');
      }
    } catch (importError: unknown) {
      setError(getErrorMessage(importError, 'Failed to import questions.'));
    } finally {
      setSavingQuestion(false);
      setBulkImporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="spinner-border text-dodger-blue" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="alert alert-info">Please log in to manage quiz questions.</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="alert alert-danger">Quiz not found.</div>
      </div>
    );
  }

  return (
    <div className="bg-ash min-vh-100">
      <div className="breadcrumbs-area quiz-fade-up">
        <h3>Quiz Questions</h3>
        <ul>
          <li>
            <Link href="/v27/cbt/admin">Quiz Management</Link>
          </li>
          <li>Questions</li>
        </ul>
      </div>

      {error && (
        <div className="alert alert-danger mg-b-20" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success mg-b-20" role="alert">
          {success}
        </div>
      )}

      <div className="row gutters-20">
        <div className="col-xl-8 col-12">
          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-1">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Manage Questions</h3>
                </div>
                <span className={statusBadgeClass(quiz.status)}>{quiz.status}</span>
              </div>

              <div className="row">
                <div className="col-lg-5 col-12">
                  <div className="border rounded p-3 mb-3">
                    {questions.length === 0 ? (
                      <p className="text-muted mb-0">No questions yet.</p>
                    ) : (
                      <ul className="list-unstyled mb-0">
                        {questions.map((question) => (
                          <li
                            key={question.id}
                            className={`d-flex justify-content-between align-items-start mb-3 p-2 rounded ${
                              activeQuestionId === question.id ? 'bg-light-blue' : 'bg-light'
                            }`}
                          >
                            <div>
                              <div className="font-weight-bold text-dark">
                                {question.order}. {question.question_text.slice(0, 60)}
                              </div>
                              <small className="text-muted">
                                {questionTypeLabels[question.question_type]} • {question.marks} mark(s)
                              </small>
                            </div>
                            <div className="d-flex flex-column align-items-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary mb-2"
                                onClick={() => handleQuestionSelect(question)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => deleteQuestion(question.id)}
                                disabled={savingQuestion}
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-fill-lmd radius-4 text-light btn-gradient-yellow"
                    onClick={() => resetQuestionForm(nextQuestionOrder)}
                  >
                    + New Question
                  </button>

                  <div className="border rounded p-3 mt-3">
                    <h5 className="mb-2">Bulk Import Questions</h5>
                    <p className="text-muted small mb-2">
                      Paste CSV rows (or upload a CSV file), then import all questions at once.
                    </p>
                    <p className="text-muted small mb-3">
                      Use <code>{`|`}</code> to separate values in cells like <code>options</code> and{' '}
                      <code>correct_answers</code>. For <strong>true_false</strong>, set <code>correct_answer</code> to true or false.
                    </p>

                    <textarea
                      className="form-control mb-2"
                      rows={9}
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder="Paste CSV bulk payload here"
                    />

                    <input
                      type="file"
                      accept=".csv,text/csv,text/plain"
                      className="form-control-file mb-3"
                      onChange={handleBulkFileSelect}
                    />

                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mr-2 mb-2"
                        onClick={() => setBulkInput(bulkImportTemplate)}
                      >
                        Use CSV Template
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mr-2 mb-2"
                        onClick={handleDownloadCsvTemplate}
                      >
                        Download CSV
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary mr-2 mb-2"
                        onClick={() => {
                          setBulkInput('');
                          setBulkImportResult(null);
                        }}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary mb-2"
                        onClick={handleBulkImport}
                        disabled={bulkImporting || !bulkInput.trim()}
                      >
                        {bulkImporting ? 'Importing...' : 'Import Questions'}
                      </button>
                    </div>

                    {bulkImportResult && (
                      <div className={`alert ${bulkImportResult.failed > 0 ? 'alert-warning' : 'alert-success'} mt-3 mb-0`}>
                        <div className="font-weight-bold">
                          Imported: {bulkImportResult.imported} | Failed: {bulkImportResult.failed}
                        </div>
                        {bulkImportResult.errors.length > 0 && (
                          <ul className="mb-0 pl-3">
                            {bulkImportResult.errors.slice(0, 5).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                        {bulkImportResult.errors.length > 5 && (
                          <div className="small mt-1">
                            Showing first 5 errors only.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-lg-7 col-12">
                  <div className="border rounded p-3">
                    <h4 className="mb-3">{isEditingQuestion ? 'Edit Question' : 'Add Question'}</h4>

                    <div className="form-group">
                      <label>Question Text *</label>
                      <textarea
                        value={questionForm.question_text}
                        onChange={(e) =>
                          setQuestionForm({ ...questionForm, question_text: e.target.value })
                        }
                        className="form-control"
                        rows={3}
                      />
                    </div>

                    <div className="row gutters-20">
                      <div className="col-md-6 col-12 form-group">
                        <label>Question Type</label>
                        <select
                          value={questionForm.question_type}
                          onChange={(e) => updateQuestionType(e.target.value as QuestionType)}
                          className="form-control"
                        >
                          {Object.entries(questionTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-3 col-6 form-group">
                        <label>Marks</label>
                        <input
                          type="number"
                          min="1"
                          value={questionForm.marks}
                          onChange={(e) =>
                            setQuestionForm({ ...questionForm, marks: Number(e.target.value) })
                          }
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-3 col-6 form-group">
                        <label>Order</label>
                        <input
                          type="number"
                          min="1"
                          value={questionForm.order}
                          onChange={(e) =>
                            setQuestionForm({ ...questionForm, order: Number(e.target.value) })
                          }
                          className="form-control"
                        />
                      </div>
                    </div>

                    <div className="row gutters-20">
                      <div className="col-12 form-group">
                        <label>Image URL (optional)</label>
                        <input
                          type="text"
                          value={questionForm.image_url}
                          onChange={(e) =>
                            setQuestionForm({ ...questionForm, image_url: e.target.value })
                          }
                          className="form-control"
                        />
                      </div>
                      <div className="col-12 form-group">
                        <label>Explanation (optional)</label>
                        <textarea
                          value={questionForm.explanation}
                          onChange={(e) =>
                            setQuestionForm({ ...questionForm, explanation: e.target.value })
                          }
                          className="form-control"
                          rows={2}
                        />
                      </div>
                    </div>

                    {questionForm.question_type === 'short_answer' ? (
                      <div className="form-group">
                        <label>Short Answer Settings</label>
                        <div className="row gutters-20">
                          <div className="col-md-6 col-12 form-group">
                            <label>Matching mode</label>
                            <select
                              value={questionForm.short_answer_match}
                              onChange={(e) =>
                                setQuestionForm({
                                  ...questionForm,
                                  short_answer_match: e.target.value as ShortAnswerMatch,
                                })
                              }
                              className="form-control"
                            >
                              {Object.entries(shortAnswerMatchLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <small className="text-muted">
                              Matching is case-insensitive and ignores punctuation.
                            </small>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Accepted answers (one per line)</label>
                          <textarea
                            value={questionForm.short_answer_answers.join('\n')}
                            onChange={(e) =>
                              setQuestionForm({
                                ...questionForm,
                                short_answer_answers: parseShortAnswerList(e.target.value),
                              })
                            }
                            className="form-control"
                            rows={4}
                            placeholder="Enter each acceptable answer on a new line."
                          />
                        </div>

                        <div className="form-group mb-0">
                          <label>Keywords (optional, one per line)</label>
                          <textarea
                            value={questionForm.short_answer_keywords.join('\n')}
                            onChange={(e) =>
                              setQuestionForm({
                                ...questionForm,
                                short_answer_keywords: parseShortAnswerList(e.target.value),
                              })
                            }
                            className="form-control"
                            rows={3}
                            placeholder="Enter keywords to look for in the student's answer."
                          />
                          <small className="text-muted">
                            Use keywords when students can phrase the answer in different ways.
                          </small>
                        </div>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>Options *</label>
                        {questionForm.options.map((option, index) => (
                          <div key={option.id ?? `option-${index}`} className="d-flex align-items-center mb-2">
                            <input
                              type="text"
                              value={option.option_text}
                              onChange={(e) => updateOptionText(index, e.target.value)}
                              className="form-control mg-r-10"
                              placeholder={`Option ${index + 1}`}
                              readOnly={questionForm.question_type === 'true_false'}
                            />
                            <div className="form-check">
                              <input
                                type={questionForm.question_type === 'multiple_select' ? 'checkbox' : 'radio'}
                                name="correct-option"
                                checked={option.is_correct}
                                onChange={(e) => updateOptionCorrect(index, e.target.checked)}
                                className="form-check-input"
                              />
                              <label className="form-check-label">Correct</label>
                            </div>
                            {questionForm.question_type !== 'true_false' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger ml-2"
                                onClick={() => removeOption(index)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}

                        {questionForm.question_type !== 'true_false' && (
                          <button
                            type="button"
                            onClick={addOption}
                            className="btn btn-sm btn-outline-primary mt-2"
                          >
                            + Add Option
                          </button>
                        )}
                      </div>
                    )}

                    <div className="d-flex justify-content-between mt-4">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => resetQuestionForm(nextQuestionOrder)}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="btn-fill-lmd btn-gradient-yellow text-light"
                        onClick={saveQuestion}
                        disabled={savingQuestion}
                      >
                        {savingQuestion ? 'Saving...' : 'Save Question'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-12">
          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-2">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Quiz Summary</h3>
                </div>
              </div>
              <ul className="list-unstyled">
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Title</span>
                  <span className="text-dark font-weight-bold">{quiz.title}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Status</span>
                  <span className="text-dark font-weight-bold">{quiz.status}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Configured Questions</span>
                  <span className="text-dark font-weight-bold">{totalQuestionCount}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Passing Score</span>
                  <span className="text-dark font-weight-bold">{quiz.passing_score}%</span>
                </li>
                <li className="d-flex justify-content-between align-items-center">
                  <span>Duration</span>
                  <span className="text-dark font-weight-bold">{quiz.duration_minutes} min</span>
                </li>
              </ul>
              {questionMismatch && (
                <div className="alert alert-warning mt-3 mb-0" role="alert">
                  Total questions is {quiz.total_questions}, but you have {totalQuestionCount} configured.
                </div>
              )}
            </div>
          </div>

          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-3">
            <div className="card-body bg-light-blue">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Navigation</h3>
                </div>
              </div>
              <button
                type="button"
                className="btn-fill-lmd radius-4 text-light bg-dodger-blue mb-2"
                onClick={() => router.push(`/v27/cbt/admin/${quizId}/edit`)}
              >
                Back to Settings
              </button>
              <button
                type="button"
                className="btn-fill-lmd radius-4 text-light btn-gradient-yellow"
                onClick={() => router.push('/v27/cbt/admin')}
              >
                Back to Quiz List
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
