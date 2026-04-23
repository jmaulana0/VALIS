const NOTION_API = 'https://api.notion.com/v1';

function notionHeaders(contentType = 'application/json') {
  return {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2026-03-11',
    'Content-Type': contentType,
  };
}

/**
 * Upload an image to Notion's File Upload API.
 * Returns the file_upload ID to reference in image blocks.
 *
 * Flow: create upload → send binary data → return ID
 */
export async function uploadImageToNotion(imageBuffer: Buffer, filename: string): Promise<string> {
  // Step 1: Create a file upload object
  const createRes = await fetch(`${NOTION_API}/file_uploads`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({}),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Notion file upload create failed ${createRes.status}: ${err}`);
  }

  const upload = await createRes.json() as { id: string };
  const fileUploadId = upload.id;

  // Step 2: Send binary data via multipart/form-data
  const formData = new FormData();
  const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
  formData.append('file', new Blob([imageBuffer], { type: mimeType }), filename);

  const sendRes = await fetch(`${NOTION_API}/file_uploads/${fileUploadId}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2026-03-11',
    },
    body: formData,
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    throw new Error(`Notion file upload send failed ${sendRes.status}: ${err}`);
  }

  return fileUploadId;
}
