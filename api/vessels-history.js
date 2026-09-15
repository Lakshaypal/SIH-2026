export default function handler(req, res) {
  // In serverless mode, no persistent track history is available.
  // Return an empty array — the client gracefully handles this.
  res.setHeader('Cache-Control', 'no-store');
  res.json([]);
}
