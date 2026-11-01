const copy = JSON.parse(document.getElementById('help-copy').textContent);
const plurals = new Intl.PluralRules(document.documentElement.lang);
const chapters = JSON.parse(
  document.getElementById('help-chapters').textContent
);
const search = document.getElementById('help-search');
const sidebar = document.querySelector('.help-sidebar');
const links = [...sidebar.querySelectorAll('nav a')];
const status = document.querySelector('.help-search-status');
const normalize = value =>
  value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
search.closest('form').hidden = false;
sidebar.querySelector('summary').textContent = copy.chaptersSearch;
const mobile = () => window.matchMedia('(max-width: 899px)').matches;
if (mobile()) sidebar.open = false;

search.addEventListener('input', () => {
  const query = normalize(search.value.trim());
  let matches = 0;
  links.forEach((link, index) => {
    link.hidden = !normalize(chapters[index].text).includes(query);
    if (!link.hidden) matches++;
  });
  status.textContent = query
    ? (
        copy['matches_' + plurals.select(matches)] || copy.matches_other
      ).replace('{{count}}', String(matches))
    : '';
});
sidebar.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  links.find(link => !link.hidden)?.click();
});
document.querySelector('.help-page').addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || !link.getAttribute('href')?.startsWith('#')) return;
  if (mobile()) sidebar.open = false;
});
const markChapter = () => {
  let id;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  links.forEach(link => {
    if (decodeURIComponent(link.hash.slice(1)) === id)
      link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  document.getElementById(id)?.focus({ preventScroll: true });
};
window.addEventListener('hashchange', markChapter);
markChapter();

const dialog = document.querySelector('.help-lightbox');
let imageTrigger;
document.querySelector('.help-article').addEventListener('click', event => {
  const link = event.target.closest('a.help-screenshot');
  if (!link) return;
  event.preventDefault();
  imageTrigger = link;
  const image = dialog.querySelector('img');
  image.src = link.href;
  image.alt = link.querySelector('img').alt;
  dialog.querySelector('p').textContent = image.alt;
  dialog.showModal();
});
dialog.querySelector('button').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener('close', () => imageTrigger?.focus());
