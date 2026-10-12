/**
 * Test-only: the task that implements each leaf route, so the route-coverage
 * test fails if a route is added or removed without updating the contract.
 * `$param` segments are replaced with concrete values.
 */
export const IMPLEMENTATION_TASK_BY_PATH: Record<string, string> = {
  '/app/overview': 'FE-09',
  '/app/applications': 'FE-03',
  '/app/applications/app_001': 'FE-03',
  '/app/endpoints': 'FE-04',
  '/app/endpoints/new': 'FE-04',
  '/app/endpoints/end_001': 'FE-04',
  '/app/events': 'FE-06',
  '/app/events/evt_001': 'FE-06',
  '/app/deliveries': 'FE-07',
  '/app/deliveries/del_001': 'FE-07',
  '/app/api-keys': 'FE-05',
  '/app/settings': 'FE-02',
};
