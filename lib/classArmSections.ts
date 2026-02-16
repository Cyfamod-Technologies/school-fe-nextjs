export interface ClassArmSection {
  id: number;
  name: string;
  arm_id?: number;
  class_id?: number;
  [key: string]: unknown;
}

export async function listClassArmSections(
  classId: number | string,
  armId: number | string,
): Promise<ClassArmSection[]> {
  void classId;
  void armId;
  return [];
}

export async function getClassArmSection(
  classId: number | string,
  armId: number | string,
  sectionId: number | string,
): Promise<ClassArmSection | null> {
  void classId;
  void armId;
  void sectionId;
  return null;
}

export async function createClassArmSection(
  classId: number | string,
  armId: number | string,
  payload: { name: string },
): Promise<ClassArmSection> {
  void classId;
  void armId;
  void payload;
  throw new Error("Class section feature has been removed.");
}

export async function updateClassArmSection(
  classId: number | string,
  armId: number | string,
  sectionId: number | string,
  payload: { name: string },
): Promise<ClassArmSection> {
  void classId;
  void armId;
  void sectionId;
  void payload;
  throw new Error("Class section feature has been removed.");
}

export async function deleteClassArmSection(
  classId: number | string,
  armId: number | string,
  sectionId: number | string,
): Promise<void> {
  void classId;
  void armId;
  void sectionId;
  throw new Error("Class section feature has been removed.");
}
