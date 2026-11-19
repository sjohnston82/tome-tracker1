export type Theme = 'light' | 'dark' | 'system'
export const validTheme = (value: unknown): Theme => value === 'light' || value === 'dark' ? value : 'system'
export const THEME_BOOTSTRAP = `(function(){var t='system';try{var s=localStorage.getItem('theme');if(s==='light'||s==='dark')t=s;}catch(e){}var d=t==='dark'||(t==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',!!d);document.documentElement.style.colorScheme=d?'dark':'light';})();`
