const VIKUNJA_URL = process.env.VIKUNJA_URL || "";
const VIKUNJA_API_TOKEN = process.env.VIKUNJA_API_TOKEN || "";

interface VikunjaTask {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  done?: boolean;
}

interface CreateTaskInput {
  title: string;
  description?: string;
  due_date?: string;
  done?: boolean;
}

async function vikunjaFetch<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${VIKUNJA_URL}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${VIKUNJA_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vikunja API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

/** Create a task in a project (Vikunja uses PUT for creation) */
export async function createTask(
  projectId: number,
  input: CreateTaskInput
): Promise<VikunjaTask> {
  return vikunjaFetch<VikunjaTask>(
    `/projects/${projectId}/tasks`,
    "PUT",
    input
  );
}

/** Update an existing task (Vikunja uses POST for updates) */
export async function updateTask(
  taskId: number,
  fields: Partial<CreateTaskInput>
): Promise<VikunjaTask> {
  return vikunjaFetch<VikunjaTask>(`/tasks/${taskId}`, "POST", fields);
}

/** Delete a task */
export async function deleteTask(taskId: number): Promise<void> {
  await vikunjaFetch<unknown>(`/tasks/${taskId}`, "DELETE");
}

interface VikunjaLabel {
  id: number;
  title: string;
  hex_color: string;
}

/** Create a label */
export async function createLabel(
  title: string,
  hexColor: string
): Promise<VikunjaLabel> {
  return vikunjaFetch<VikunjaLabel>("/labels", "PUT", {
    title,
    hex_color: hexColor,
  });
}

/** Get all labels */
export async function getLabels(): Promise<VikunjaLabel[]> {
  return vikunjaFetch<VikunjaLabel[]>("/labels", "GET");
}

/** Add a label to a task */
export async function addLabelToTask(
  taskId: number,
  labelId: number
): Promise<void> {
  await vikunjaFetch<unknown>(`/tasks/${taskId}/labels`, "PUT", {
    label_id: labelId,
  });
}
