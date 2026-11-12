// The board publishes its current save so sidebar navigation can wait for it.
export const workflowCompletionSave: { pending: Promise<boolean> | null } = { pending: null }
