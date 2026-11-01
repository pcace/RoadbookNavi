import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { renderHelpMarkdown } from '../utils/helpMarkdown';
import './HelpContent.css';

export const HelpContent = () => {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('de') ? 'de' : 'en';
  const german = language === 'de';
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
    () => renderHelpMarkdown(markdown, base),
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
        {german ? 'Zur Anleitung' : 'Skip to guide'}
      </a>
      <div className="help-layout">
        <details className="help-sidebar" ref={navigation} open>
          <summary>{german ? 'Kapitel & Suche' : 'Chapters & search'}</summary>
          <div className="help-sidebar-content">
            <button
              className="help-back"
              onClick={() => navigate(returnTo.current)}
            >
              ← {german ? 'Zur App zurück' : 'Back to the app'}
            </button>
            <form
              onSubmit={event => {
                event.preventDefault();
                if (matches[0]) openChapter(matches[0].id);
              }}
            >
              <label htmlFor="help-search">
                {german ? 'Hilfe durchsuchen' : 'Search this guide'}
              </label>
              <input
                id="help-search"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={
                  german ? 'z. B. exportieren, GPS …' : 'e.g. export, GPS …'
                }
              />
            </form>
            <p className="help-search-status" role="status">
              {query &&
                (german
                  ? `${matches.length} passende Kapitel`
                  : `${matches.length} matching chapters`)}
            </p>
            <nav aria-label={german ? 'Hilfekapitel' : 'Help chapters'}>
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
              {german ? 'Anleitung als Markdown' : 'Read the Markdown file'}
            </a>
          </div>
        </details>
        <main id="help-article" className="help-article" tabIndex={-1}>
          {loading ? (
            <p role="status">
              {german ? 'Anleitung wird geladen …' : 'Loading guide …'}
            </p>
          ) : error ? (
            <div role="alert">
              <p>
                {german
                  ? 'Die Hilfe konnte nicht geladen werden.'
                  : 'The guide could not be loaded.'}
              </p>
              <button onClick={() => window.location.reload()}>
                {german ? 'Erneut versuchen' : 'Try again'}
              </button>
            </div>
          ) : (
            <div
              onClick={event => {
                const link = (event.target as HTMLElement).closest('a');
                if (!link) return;
                if (link.classList.contains('help-screenshot')) {
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
        aria-label={
          german ? 'Screenshot in voller Größe' : 'Full-size screenshot'
        }
        onClose={() => setImage(null)}
        onClick={event => {
          if (event.target === event.currentTarget) setImage(null);
        }}
      >
        <button className="help-lightbox-close" onClick={() => setImage(null)}>
          {german ? 'Schließen' : 'Close'} ×
        </button>
        {image && <img src={image.src} alt={image.alt} />}
        <p>{image?.alt}</p>
      </dialog>
    </div>
  );
};
