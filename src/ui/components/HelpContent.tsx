import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { Box, Flex, Spinner } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import { useColorModeValue } from './ui/color-mode';

type HelpContentProps = {
  enabled?: boolean;
  height?: string;
  padding?: number;
};

const HelpContentComponent: React.FC<HelpContentProps> = ({
  enabled = true,
  height,
  padding = 8,
}) => {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const contentBoxRef = useRef<HTMLDivElement>(null);

  const textColor = useColorModeValue('gray.700', 'gray.200');

  // CSS color values - call hooks at top level, then memoize
  const h1BorderColor = useColorModeValue('#E2E8F0', '#4A5568');
  const imgBorderColor = useColorModeValue('#E2E8F0', '#4A5568');
  const blockquoteBg = useColorModeValue('#EBF8FF', '#1A365D');
  const codeBg = useColorModeValue('#EDF2F7', '#2D3748');
  const hrBorderColor = useColorModeValue('#E2E8F0', '#4A5568');

  const cssColors = useMemo(
    () => ({
      h1BorderColor,
      imgBorderColor,
      blockquoteBg,
      codeBg,
      hrBorderColor,
    }),
    [h1BorderColor, imgBorderColor, blockquoteBg, codeBg, hrBorderColor]
  );

  // Load markdown file based on current language
  useEffect(() => {
    if (!enabled) return;

    const loadMarkdown = async () => {
      setLoading(true);
      setError(null);

      try {
        const lang = i18n.language.startsWith('de') ? 'de' : 'en';
        const response = await fetch(`/help/native-${lang}.md`);

        if (!response.ok) {
          throw new Error(`Failed to load help file: ${response.statusText}`);
        }

        const text = await response.text();

        // Initialize markdown-it with anchor plugin
        const md = new MarkdownIt({
          html: true,
          linkify: true,
          typographer: true,
        }).use(markdownItAnchor, {
          // NOTE: do NOT pass `permalink: false` — markdown-it-anchor 9.x
          // types only allow a PermalinkGenerator here; omitting the option
          // is the (runtime-equivalent) way to disable permalinks.
          level: [2, 3],
          slugify: (s: string) => {
            const umlautMap: { [key: string]: string } = {
              ä: 'a',
              ö: 'o',
              ü: 'u',
              ß: 'ss',
              Ä: 'A',
              Ö: 'O',
              Ü: 'U',
            };
            return s
              .toLowerCase()
              .replace(/[äöüßÄÖÜ]/g, match => umlautMap[match] || match)
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
          },
        });

        const htmlContent = md.render(text);
        setContent(htmlContent);
      } catch (err) {
        console.error('Error loading markdown:', err);
        setError(t('help.errorLoading') || 'Error loading help content');
      } finally {
        setLoading(false);
      }
    };

    loadMarkdown();
  }, [enabled, i18n.language, t]);

  // Handle anchor link clicks
  const handleAnchorClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');

    if (anchor && anchor.hash) {
      e.preventDefault();

      const targetId = anchor.hash.substring(1);
      const element = document.getElementById(targetId);

      if (element) {
        // Only update URL hash if we're on the documentation page
        const isDocumentationPage =
          window.location.pathname === '/documentation';
        if (isDocumentationPage) {
          window.history.pushState(null, '', anchor.hash);
        }
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  // Attach event listener for anchor clicks
  useEffect(() => {
    const contentBox = contentBoxRef.current;
    if (!contentBox || !content) return;

    contentBox.addEventListener('click', handleAnchorClick);

    return () => {
      contentBox.removeEventListener('click', handleAnchorClick);
    };
  }, [content, handleAnchorClick]);

  // Scroll to hash fragment on initial load or when content changes
  useEffect(() => {
    if (!content || loading) return;

    const hash = window.location.hash;
    if (hash) {
      // Small delay to ensure content is fully rendered
      setTimeout(() => {
        const targetId = hash.substring(1);
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [content, loading]);

  return (
    <Box
      ref={contentBoxRef}
      overflowY="auto"
      overflowX="hidden"
      h={height}
      p={padding}
    >
      {loading ? (
        <Flex justify="center" align="center" h={height ? '100%' : undefined}>
          <Spinner size="xl" />
        </Flex>
      ) : error ? (
        <Box color="red.500" textAlign="center">
          {error}
        </Box>
      ) : (
        <Box
          className="markdown-content"
          color={textColor}
          maxWidth="100%"
          wordBreak="break-word"
          dangerouslySetInnerHTML={{ __html: content }}
          css={{
            '& h1': {
              fontSize: '1.875rem',
              fontWeight: 'bold',
              marginTop: '1.5rem',
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              borderBottom: `2px solid ${cssColors.h1BorderColor}`,
            },
            '& h2': {
              fontSize: '1.5rem',
              fontWeight: '600',
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
            },
            '& h3': {
              fontSize: '1.25rem',
              fontWeight: '600',
              marginTop: '1rem',
              marginBottom: '0.5rem',
            },
            '& p': {
              marginBottom: '1rem',
              lineHeight: '1.7',
            },
            '& img': {
              maxWidth: '100%',
              width: '100%',
              height: 'auto',
              borderRadius: '0.375rem',
              marginTop: '1rem',
              marginBottom: '1rem',
              border: `1px solid ${cssColors.imgBorderColor}`,
              objectFit: 'contain',
            },
            '& video': {
              maxWidth: '100%',
              width: '100%',
              height: 'auto',
              borderRadius: '0.375rem',
              marginTop: '1rem',
              marginBottom: '1rem',
              border: `1px solid ${cssColors.imgBorderColor}`,
              objectFit: 'contain',
              display: 'block',
            },
            '& ul, & ol': {
              marginBottom: '1rem',
              paddingLeft: '1.5rem',
            },
            '& li': {
              marginBottom: '0.5rem',
            },
            '& blockquote': {
              paddingLeft: '1rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              marginTop: '1rem',
              marginBottom: '1rem',
              borderLeft: '4px solid #3182CE',
              backgroundColor: cssColors.blockquoteBg,
              borderRadius: '0.375rem',
            },
            '& blockquote p': {
              marginBottom: '0',
            },
            '& code': {
              backgroundColor: cssColors.codeBg,
              paddingLeft: '0.5rem',
              paddingRight: '0.5rem',
              paddingTop: '0.25rem',
              paddingBottom: '0.25rem',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
            },
            '& pre': {
              backgroundColor: cssColors.codeBg,
              padding: '1rem',
              borderRadius: '0.375rem',
              overflowX: 'auto',
              marginBottom: '1rem',
              maxWidth: '100%',
            },
            '& pre code': {
              backgroundColor: 'transparent',
              padding: '0',
            },
            '& hr': {
              marginTop: '2rem',
              marginBottom: '2rem',
              borderColor: cssColors.hrBorderColor,
            },
            '& a': {
              color: '#3182CE',
              textDecoration: 'underline',
              '&:hover': {
                color: '#2C5282',
              },
            },
            '& strong': {
              fontWeight: 'bold',
            },
            '& em': {
              fontStyle: 'italic',
            },
          }}
        />
      )}
    </Box>
  );
};

// Export memoized version to prevent unnecessary re-renders
export const HelpContent = React.memo(
  HelpContentComponent,
  (prevProps, nextProps) => {
    // Only re-render if these props actually change
    return (
      prevProps.enabled === nextProps.enabled &&
      prevProps.height === nextProps.height &&
      prevProps.padding === nextProps.padding
    );
  }
);
