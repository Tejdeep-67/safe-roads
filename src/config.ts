// links in one place so they are easy to change
export const SITE_URL = 'https://safe-roads-ai.netlify.app';
export const REPO_URL = 'https://github.com/Tejdeep-67/safe-roads';

// numbers about the model that are shown in the UI - all measured, see model/README.md
export const MODEL_FACTS = {
  name: 'YOLOv8n-seg',
  params: 3258259,
  sizeMB: 14,
  // measured with model/evaluate.py on the Roboflow "Potholes Detection" test split (100 images)
  testMap50: 0.34,
  testImages: 100,
};

export const ALERT_BUFFER_M = 30;
