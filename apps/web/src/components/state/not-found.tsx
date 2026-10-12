import { Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * FE-01 D7 — the 404 route.
 *
 * A `404` is never reinterpreted as "the resource exists somewhere else"
 * (INV-01, apps/web/AGENTS.md §3.4).
 */
export function NotFound(): React.JSX.Element {
  return (
    <Card data-testid="not-found">
      <CardHeader>
        <CardTitle>Page not found</CardTitle>
        <CardDescription>
          This page does not exist, or the resource is not part of your organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/overview">Back to Overview</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
