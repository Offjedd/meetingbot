/**
 * Returns a URL for accessing a recording stored on local disk.
 * The recording files are served by the /api/recordings/[filename] route.
 */
export const generateSignedUrl = async (key: string) => {
  const baseUrl = process.env.PUBLIC_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/api/recordings/${key}`;
};
