import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { renderHelpMarkdown } from '../utils/helpMarkdown';
import { normalizeLanguage } from '../i18n/languages';
import { setLanguage } from '../utils/setLanguage';
import './HelpContent.css';

export const HelpContent = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = useRef('/app/routes-list');
  const from = location.state?.helpFrom;
  if (
    typeof from === 'string' &&
    from.startsWith('/app/') &&
    !from.startsWith('/app/help')
  )
    returnTo.current = from;
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const navigation = useRef<HTMLDetailsElement>(null);
  const base = `${import.meta.env.BASE_URL}help/`;
  const section = params.get('section');
  useEffect(() => {
    if (window.matchMedia('(max-width: 899px)').matches && navigation.current)
      navigation.current.open = false;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setQuery('');
    fetch(`${base}${language}.md`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then(setMarkdown)
      .catch(error => {
        if (error.name !== 'AbortError') setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [base, language]);

  const { html, chapters } = useMemo(
    () =>
      renderHelpMarkdown(
        markdown,
        base,
        language => `?lng=${language}#/app/help`
      ),
    [markdown, base]
  );
  const normalize = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const matches = chapters.filter(chapter =>
    normalize(chapter.text).includes(normalize(query.trim()))
  );

  useEffect(() => {
    if (loading || !section) return;
    const frame = requestAnimationFrame(() => {
      const heading = document.getElementById(section);
      heading?.scrollIntoView({ block: 'start' });
      heading?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [html, loading, section]);

  useEffect(() => {
    if (image && !dialog.current?.open) dialog.current?.showModal();
    if (!image && dialog.current?.open) dialog.current.close();
  }, [image]);

  const openChapter = (id: string) => {
    setParams({ section: id }, { state: { helpFrom: returnTo.current } });
    const heading = document.getElementById(id);
    heading?.scrollIntoView({ block: 'start' });
    heading?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 899px)').matches && navigation.current)
      navigation.current.open = false;
  };

  return (
    <div className="help-page help-in-app" lang={language}>
      <a
        className="help-skip"
        href="#help-article"
        onClick={event => {
          event.preventDefault();
          document.getElementById('help-article')?.focus();
        }}
      >
        {t('help.skip')}
      </a>
      <div className="help-layout">
        <details className="help-sidebar" ref={navigation} open>
          <summary>{t('help.chaptersSearch')}</summary>
          <div className="help-sidebar-content">
            <button
              className="help-back"
              onClick={() => navigate(returnTo.current)}
            >
              ← {t('help.back')}
            </button>
            <form
              onSubmit={event => {
                event.preventDefault();
                if (matches[0]) openChapter(matches[0].id);
              }}
            >
              <label htmlFor="help-search">{t('help.searchLabel')}</label>
              <input
                id="help-search"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('help.searchPlaceholder')}
              />
            </form>
            <p className="help-search-status" role="status">
              {query && t('help.matches', { count: matches.length })}
            </p>
            <nav aria-label={t('help.chapterNavigation')}>
              {matches.map(chapter => (
                <a
                  key={chapter.id}
                  href={`#/app/help?section=${encodeURIComponent(chapter.id)}`}
                  aria-current={section === chapter.id ? 'location' : undefined}
                  onClick={event => {
                    event.preventDefault();
                    openChapter(chapter.id);
                  }}
                >
                  {chapter.title}
                </a>
              ))}
            </nav>
            <a className="help-source" href={`${base}${language}.md`}>
              {t('help.markdown')}
            </a>
          </div>
        </details>
        <main id="help-article" className="help-article" tabIndex={-1}>
          {loading ? (
            <p role="status">{t('help.loading')}</p>
          ) : error ? (
            <div role="alert">
              <p>{t('help.errorLoading')}</p>
              <button onClick={() => window.location.reload()}>
                {t('help.retry')}
              </button>
            </div>
          ) : (
            <div
              onClick={event => {
                const link = (event.target as HTMLElement).closest('a');
                if (!link) return;
                if (
                  link.dataset.helpLanguage &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  setParams({}, { state: { helpFrom: returnTo.current } });
                  void setLanguage(link.dataset.helpLanguage);
                  const article = document.getElementById('help-article');
                  article?.scrollIntoView({ block: 'start' });
                  article?.focus({ preventScroll: true });
                } else if (link.classList.contains('help-screenshot')) {
                  event.preventDefault();
                  setImage({
                    src: link.href,
                    alt: link.querySelector('img')?.alt || '',
                  });
                } else if (link.getAttribute('href')?.startsWith('#')) {
                  event.preventDefault();
                  openChapter(
                    decodeURIComponent(link.getAttribute('href')!.slice(1))
                  );
                }
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </main>
      </div>
      <dialog
        ref={dialog}
        className="help-lightbox"
        aria-label={t('help.fullSize')}
        onClose={() => setImage(null)}
        onClick={event => {
          if (event.target === event.currentTarget) setImage(null);
        }}
      >
        <button className="help-lightbox-close" onClick={() => setImage(null)}>
          {t('buttons.close')} ×
        </button>
        {image && <img src={image.src} alt={image.alt} />}
        <p>{image?.alt}</p>
      </dialog>
    </div>
  );
};
