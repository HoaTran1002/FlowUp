import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * FE-01 §4 — a phase-1 route placeholder.
 *
 * It states which task implements the screen and shows NO data: a placeholder
 * must not fake a payload or a success path, because a fake success is
 * indistinguishable from a real one in a screenshot or a demo
 * (apps/web/AGENTS.md §1).
 */
export interface PlaceholderPageProps {
  title: string;
  /** The task that implements this screen, e.g. `FE-03`. */
  task: string;
  /** What the screen will do, in the words of the UX specification. */
  summary: string;
  /** An open ADR that blocks the screen, when one does. */
  blockedBy?: string;
}

export function PlaceholderPage({
  title,
  task,
  summary,
  blockedBy,
}: PlaceholderPageProps): React.JSX.Element {
  return (
    <Card data-testid="route-placeholder" data-task={task}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge variant="outline">Not implemented · {task}</Badge>
          {blockedBy !== undefined && <Badge variant="warning">Blocked by {blockedBy}</Badge>}
        </div>
        <CardDescription>{summary}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          FlowUp phase 1 builds the application shell, routing and the typed API client. This screen
          is implemented by <span className="font-medium">{task}</span> and shows no data until then.
        </p>
      </CardContent>
    </Card>
  );
}
