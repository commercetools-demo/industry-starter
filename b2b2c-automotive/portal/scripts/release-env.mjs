/** A release build: RELEASE=1, or a production Netlify context. */
export const isRelease = (env) => env.RELEASE === '1' || (env.NODE_ENV === 'production' && env.CONTEXT === 'production');
