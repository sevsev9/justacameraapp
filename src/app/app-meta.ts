/**
 * Static app metadata. Keep APP_VERSION in sync with package.json on release.
 * The repository URL is configurable at build time via VITE_REPO_URL so the
 * "View source" link can point at a fork.
 */
export const APP_NAME = 'justacamera.app'
export const APP_VERSION = '0.1.0'

const envRepo = import.meta.env.VITE_REPO_URL
export const REPO_URL =
  typeof envRepo === 'string' && envRepo.length > 0
    ? envRepo
    : 'https://github.com/sevsev9/justacameraapp'

export const PRIVACY_PROMISE =
  'Your photos, videos, audio, and camera frames never leave this device.'
