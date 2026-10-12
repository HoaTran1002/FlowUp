import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Action-feedback provider (FE-01 D7).
 *
 * Feedback is driven by an API response, never by an optimistic assumption
 * (UI_UX_SPECIFICATION.md §5). A toast must never carry a credential value
 * (INV-08).
 */
export function Toaster(props: ToasterProps): React.JSX.Element {
  return <Sonner position="bottom-right" closeButton richColors {...props} />;
}

export { toast } from 'sonner';
