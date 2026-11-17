/** A display projection only: never reruns assignment for a staff filter. */
export function toPlanCards(plan, {tasks = [], staffIds = []} = {}) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const assignments = plan.assignments.filter(item => !staffIds.length || staffIds.includes(item.personId));
  return {
    schemaVersion: 1,
    day: plan.day,
    cards: [
      ...assignments.map(item => ({
        taskId: item.taskId, title: item.title, equipment: item.equipment,
        status: 'proposed', reasonCode: 'ASSIGNABLE', reason: item.explanation,
        person: {id: item.personId, name: item.personName},
        time: {start: item.start, end: item.end}
      })),
      ...plan.unassigned.map(item => ({
        taskId: item.taskId, title: item.title, equipment: byId.get(item.taskId)?.equipment || '',
        status: 'unassigned', reasonCode: 'UNASSIGNED', reason: item.reason,
        person: null, time: null
      }))
    ]
  };
}
