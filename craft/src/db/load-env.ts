/** CLI scripts (migrate, seed, daily job) read `.env` when present; hosted builds already have their variables set. */
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the process environment.
}
