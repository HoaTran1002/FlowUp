import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';
import { Button } from './button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

describe('shadcn/ui baseline', () => {
  it('renders a primitive and is keyboard operable', async () => {
    let clicks = 0;
    render(
      <Button
        onClick={() => {
          clicks += 1;
        }}
      >
        Save
      </Button>,
    );

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(clicks).toBe(1);
  });

  it('declares a visible focus style on interactive primitives', () => {
    render(<Button>Focusable</Button>);

    expect(screen.getByRole('button').className).toContain('focus-visible:outline-2');
  });

  it('conveys a status as text, so it is legible without color', () => {
    render(<Badge variant="destructive">FAILED</Badge>);

    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });

  it('wraps tables in a horizontal scroll container', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>del_001</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(container.querySelector('[data-slot="table-container"]')).toHaveClass('overflow-x-auto');
  });
});
