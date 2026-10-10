/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Integration tests use their own build directory alongside an active dev server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default config;
