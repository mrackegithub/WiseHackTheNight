/**
 * multipart/form-data body for POST /integrations/neptun/upload. The generated type says
 * `file: string` for `format: binary`, but the payload is the File itself.
 */
export function icsUploadForm(body: { file: string }) {
  const form = new FormData();
  form.append('file', body.file as unknown as Blob); // reason: see above
  return form;
}
