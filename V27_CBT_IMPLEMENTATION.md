# CBT (Computer-Based Test) Implementation on v27

## Overview

Successfully set up CBT (Computer-Based Test) system on version 27 (v27) of the School Management System frontend. This implementation provides a complete, modern interface for students to take quizzes and view their results.

## Directory Structure

```
nextjs/app/(app)/v27/
├── cbt/
│   ├── layout.tsx              # Shared layout with gradient background
│   ├── page.tsx                # Quiz listing and home page
│   ├── history/
│   │   └── page.tsx            # Attempt history view
│   ├── [quizId]/
│   │   └── take/
│   │       └── page.tsx        # Quiz taking interface
│   └── results/
│       └── [attemptId]/
│           └── page.tsx        # Results display page
```

## Pages Created

### 1. **CBT Home Page** (`/v27/cbt`)
- Lists all available quizzes with filtering options
- Shows quiz details: title, duration, number of questions, passing score, status
- Filter tabs: Available, Attempted, All Quizzes
- Action buttons: "Start Quiz" or "View Results"
- Responsive grid layout with beautiful card design
- Features:
  - Quiz status indicators (draft, published, closed)
  - Attempted quiz tracking
  - Error handling and loading states
  - Color-coded status badges

### 2. **Quiz Taking Interface** (`/v27/cbt/[quizId]/take`)
- Full-featured quiz interface with:
  - **Timer Management**: Countdown timer with auto-submit on timeout
  - **Question Display**: Renders questions with images (when available)
  - **Multiple Question Types**:
    - Multiple Choice (MCQ) - radio buttons
    - True/False - binary toggle
    - Multiple Select - checkboxes for multiple correct answers
    - Short Answer - text input for manual grading
  - **Navigation Features**:
    - Previous/Next buttons to move between questions
    - Question palette sidebar showing:
      - Visual indicator of answered/unanswered questions
      - Current question highlighting
      - Direct jump to any question
    - Progress tracking (answered count)
  - **Time Display**: Real-time countdown with hours, minutes, seconds
  - **Submission**: 
    - Confirmation dialog before final submission
    - Shows number of attempted vs total questions
    - Prevents accidental submission
  - **Answer Tracking**: Automatically tracks all answers per question

### 3. **Results Page** (`/v27/cbt/results/[attemptId]`)
- Comprehensive results display with:
  - **Grade Display**: Large, color-coded grade (A-F) with pass/fail status
  - **Score Summary**: 
    - Percentage score
    - Marks obtained vs total
  - **Statistics Grid** (4 columns):
    - Total Questions
    - Attempted Questions
    - Correct Answers
    - Accuracy Percentage
  - **Performance Breakdown** with visual progress bars:
    - Attempted Questions progress
    - Correct Answers progress
    - Marks Obtained progress
  - **Submission Details**: When submitted and graded timestamps
  - **Color-Coded Grades**:
    - A: Green (90%+)
    - B: Blue (80-89%)
    - C: Yellow (70-79%)
    - D: Orange (60-69%)
    - F: Red (<60%)

### 4. **Attempt History Page** (`/v27/cbt/history`)
- Table view of all quiz attempts showing:
  - Quiz name
  - Date started
  - Attempt status (in progress, submitted, graded)
  - Score obtained
  - Grade (if graded)
  - Quick action to view results
- Features:
  - Sortable information display
  - Status badges with color coding
  - Easy navigation to detailed results

## Key Features Implemented

### 1. **Authentication & Authorization**
- Uses `useAuth()` hook to ensure user is logged in
- Redirects unauthenticated users to login
- Student-specific API calls with proper credentials

### 2. **Real-Time Timer**
- Countdown timer that updates every second
- Auto-submits quiz when time expires
- Formatted display: hours, minutes, seconds
- Warning-capable design for future enhancements

### 3. **Answer Management**
- Stores all answers in a Map structure for fast lookup
- Tracks answer type (single select, multiple select, text)
- Persists answers until submission
- Prevents re-answering already submitted responses

### 4. **API Integration**
- Uses `apiFetch` for all API calls
- Endpoints:
  - `GET /api/v1/quizzes` - List all quizzes
  - `GET /api/v1/quizzes/{id}` - Get quiz details
  - `GET /api/v1/quizzes/{id}/questions` - Get quiz questions
  - `POST /api/v1/quiz-attempts` - Start attempt
  - `POST /api/v1/quiz-answers` - Submit individual answers
  - `POST /api/v1/quiz-attempts/{id}/submit` - Submit entire quiz
  - `GET /api/v1/quiz-results/{attemptId}` - Get results
  - `GET /api/v1/quiz-attempts/history` - Get attempt history

### 5. **UI/UX Enhancements**
- Gradient backgrounds (blue to indigo)
- Smooth transitions and hover effects
- Responsive design (mobile, tablet, desktop)
- Loading states with spinners
- Error handling with user-friendly messages
- Color-coded visual feedback
- Clear typography hierarchy
- Shadow effects for depth

## TypeScript Types

```typescript
interface Quiz {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  total_questions: number;
  passing_score: number;
  status: 'draft' | 'published' | 'closed';
  attempted?: boolean;
}

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: 'mcq' | 'multiple_select' | 'true_false' | 'short_answer';
  marks: number;
  order: number;
  image_url?: string;
  explanation?: string;
  options: QuizOption[];
}

interface QuizResult {
  id: string;
  attempt_id: string;
  quiz_id: string;
  total_questions: number;
  attempted_questions: number;
  correct_answers: number;
  total_marks: number;
  marks_obtained: number;
  percentage: number;
  grade: string;
  status: 'pass' | 'fail';
  submitted_at: string;
  graded_at: string;
}
```

## Navigation Flow

```
/v27/cbt (Home)
├── [Filter/Browse Quizzes]
├── Click "Start Quiz"
│   └── /v27/cbt/[quizId]/take (Quiz Interface)
│       ├── Answer Questions
│       ├── Navigate Questions
│       └── Submit Quiz
│           └── /v27/cbt/results/[attemptId] (Results Page)
│
├── Click "View Results"
│   └── /v27/cbt/results/[attemptId] (Results Page)
│       └── Click "View History"
│           └── /v27/cbt/history (History Page)
│               └── Click "View Results" on an attempt
│                   └── /v27/cbt/results/[attemptId]
```

## Styling

- **Framework**: Tailwind CSS
- **Color Scheme**:
  - Primary: Indigo-600
  - Secondary: Blue-600
  - Success: Green-600
  - Warning: Yellow-600
  - Danger: Red-600
- **Layout**: Responsive grid system
- **Components**: Rounded borders, shadow effects, gradient backgrounds

## State Management

Each page uses React hooks for state management:
- `useState` for component state (quizzes, answers, timer, etc.)
- `useEffect` for side effects (loading data, starting timer)
- `useAuth` for authentication context
- `useRouter` for navigation

## Error Handling

- Try-catch blocks for API calls
- User-friendly error messages
- Fallback UI for error states
- Loading spinners during data fetching

## Next Steps

1. **Backend API Implementation**: Ensure all CBT endpoints are implemented and working
2. **Database Setup**: Create necessary migrations for quiz, questions, attempts, and results tables
3. **Authentication**: Verify student authentication works correctly
4. **Testing**: Thoroughly test the quiz taking flow end-to-end
5. **Performance**: Optimize API calls and component rendering
6. **Accessibility**: Add ARIA labels and keyboard navigation support
7. **Mobile Optimization**: Test and optimize for mobile devices
8. **Advanced Features**: Add proctoring, question review, analytics

## Files Created

- `/home/cloud/Videos/SCHOOL/nextjs/app/(app)/v27/cbt/layout.tsx`
- `/home/cloud/Videos/SCHOOL/nextjs/app/(app)/v27/cbt/page.tsx`
- `/home/cloud/Videos/SCHOOL/nextjs/app/(app)/v27/cbt/[quizId]/take/page.tsx`
- `/home/cloud/Videos/SCHOOL/nextjs/app/(app)/v27/cbt/results/[attemptId]/page.tsx`
- `/home/cloud/Videos/SCHOOL/nextjs/app/(app)/v27/cbt/history/page.tsx`

---

**Created**: January 10, 2026
**Version**: 1.0
**Status**: Ready for Backend Integration
