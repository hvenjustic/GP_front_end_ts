declare module 'react-markdown' {
  import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';

  type MarkdownTag =
    | 'a'
    | 'blockquote'
    | 'br'
    | 'code'
    | 'em'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'hr'
    | 'img'
    | 'li'
    | 'ol'
    | 'p'
    | 'pre'
    | 'strong'
    | 'table'
    | 'tbody'
    | 'td'
    | 'th'
    | 'thead'
    | 'tr'
    | 'ul';

  type MarkdownComponentProps<T extends MarkdownTag> = ComponentPropsWithoutRef<T> & {
    children?: ReactNode;
    inline?: boolean;
    node?: unknown;
  };

  type Components = Partial<{
    [Tag in MarkdownTag]: (props: MarkdownComponentProps<Tag>) => ReactElement | null;
  }>;

  type ReactMarkdownProps = {
    children?: string;
    className?: string;
    components?: Components;
  };

  export default function ReactMarkdown(props: ReactMarkdownProps): ReactElement | null;
}
