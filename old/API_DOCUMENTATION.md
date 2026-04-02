# API Key System Documentation

This CDN now supports API key-based access for programmatic file operations. Here's how to use it:

## Getting Started

1. **Create an API Key**: Go to the API Keys tab in the web interface and create a new API key
2. **Set Permissions**: Choose from `read`, `write`, `delete`, and `list` permissions
3. **Set Scoped Paths**: Define which folders the API key can access (e.g., `/uploads/`, `/public/`)

## API Endpoints

All API endpoints are located under `/api/v1/` and require authentication via Bearer token.

### Authentication

Include the API key in the Authorization header:

```
Authorization: Bearer hcdn_your_api_key_here
```

### Upload Files

**POST** `/api/v1/upload`

Request body:

```json
{
	"path": "/uploads/images/",
	"filename": "photo.jpg",
	"fileType": "image/jpeg"
}
```

Response:

```json
{
	"success": true,
	"uploadUrl": "https://presigned-upload-url...",
	"fileKey": "/uploads/images/photo.jpg",
	"originalName": "photo.jpg",
	"sanitizedName": "photo.jpg"
}
```

Then upload the file to the `uploadUrl` using a PUT request.

### List Objects

**GET** `/api/v1/list?path=/uploads/&limit=100`

Response:

```json
{
	"success": true,
	"path": "/uploads/",
	"objects": [
		{
			"key": "/uploads/image1.jpg",
			"size": 1024,
			"lastModified": "2024-01-01T00:00:00.000Z",
			"etag": "\"abc123\""
		}
	],
	"count": 1
}
```

### Download Files

**GET** `/api/v1/download?key=/uploads/image1.jpg`

Response:

```json
{
	"success": true,
	"key": "/uploads/image1.jpg",
	"downloadUrl": "https://your-cdn-url.com/uploads/image1.jpg"
}
```

### Delete Files

**DELETE** `/api/v1/delete`

Request body:

```json
{
	"key": "/uploads/image1.jpg"
}
```

Response:

```json
{
	"success": true,
	"message": "Object deleted successfully",
	"key": "/uploads/image1.jpg"
}
```

## Example

### JavaScript/Node.js Example

```javascript
const API_KEY = 'hcdn_your_api_key_here';
const BASE_URL = 'https://cdn.haelp.dev/api/v1';

const headers = {
	Authorization: `Bearer ${API_KEY}`,
	'Content-Type': 'application/json'
};

// Upload a file
async function uploadFile(file, targetPath, filename) {
	// Step 1: Get upload URL
	const response = await fetch(`${BASE_URL}/upload`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			path: targetPath,
			filename: filename,
			fileType: file.type
		})
	});

	const result = await response.json();

	if (result.success) {
		// Step 2: Upload file
		const uploadResponse = await fetch(result.uploadUrl, {
			method: 'PUT',
			body: file
		});

		return uploadResponse.ok;
	}

	return false;
}

// List files
async function listFiles(path = '/') {
	const response = await fetch(`${BASE_URL}/list?path=${encodeURIComponent(path)}&limit=100`, {
		headers
	});

	const result = await response.json();
	return result.success ? result.objects : [];
}

// Delete file
async function deleteFile(key) {
	const response = await fetch(`${BASE_URL}/delete`, {
		method: 'DELETE',
		headers,
		body: JSON.stringify({ key })
	});

	const result = await response.json();
	return result.success;
}
```


## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: API key doesn't have required permissions or path access
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Example error response:

```json
{
	"error": "Missing write permission"
}
```

## Security Notes

- API keys are prefixed with `hcdn_` for identification
- Store API keys securely and never expose them in client-side code
- Use HTTPS for all API requests
- API keys have scoped access - they can only access the paths you specify
- You can deactivate or delete API keys at any time through the web interface
