export const THEME_STORAGE_KEY = 'malva-portal-theme';

/** Runs before first paint (inline script in the root layout) so there is no flash of the wrong theme. */
export const themeInitScript = `(()=>{try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`;
