import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * FE-01 D7 — the access-denied view the router can render for a `403`.
 *
 * Phase 1 only provides the view. The decision to show it belongs to the
 * server's answer, never to a client-side role check: the server is the sole
 * authorization gate (apps/web/AGENTS.md §3.3). FE-02 wires it up.
 */
export function AccessDenied(): React.JSX.Element {
  return (
    <Card data-testid="access-denied">
      <CardHeader>
        <CardTitle>You do not have access to this page</CardTitle>
        <CardDescription>
          Your organization role does not include this function. Ask an Admin in your organization
          if you need it.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Nothing about the resource is shown here, including whether it exists.
      </CardContent>
    </Card>
  );
}
