import { useState, useEffect } from 'react';
import { X, User, Upload, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { reportAPI, userAPI } from '../lib/api';

interface Report {
  _id: string;
  user_id: string;
  pothole_id: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  confidence: number;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
}

interface ProfilePanelProps {
  onClose: () => void;
  onPotholeUploaded?: () => void;
}

export function ProfilePanel({ onClose, onPotholeUploaded }: ProfilePanelProps) {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'reports' | 'upload'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'reports' && user) {
      fetchReports();
    }
  }, [activeTab, user]);

  const fetchReports = async () => {
    try {
      const response = await userAPI.getReports();
      setReports(response.data.reports);
    } catch (error) {
      console.error('Fetch reports error:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadStatus('❌ File size must be less than 10MB');
      setTimeout(() => setUploadStatus(''), 3000);
      return;
    }

    setLoading(true);
    setUploadStatus('Processing image...');

    try {
      const response = await reportAPI.uploadReport(file);

      if (response.data.message === 'No pothole detected') {
        setUploadStatus('⚠️ No pothole detected in the image. Please try another photo.');
        setTimeout(() => setUploadStatus(''), 3000);
      } else {
        setUploadStatus('✅ Pothole reported successfully!');
        // Trigger refresh in parent component immediately
        onPotholeUploaded?.();
        setTimeout(() => {
          setUploadStatus('');
          setActiveTab('reports');
          fetchReports();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      let errorMessage = 'Error uploading report';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setUploadStatus(`❌ ${errorMessage}`);
      setTimeout(() => setUploadStatus(''), 4000);
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await reportAPI.deleteReport(reportId);
      fetchReports();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete report');
    }
  };

  return (
    <div className="absolute top-0 right-0 md:right-0 z-[1000] w-full md:w-96 h-full bg-white shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="px-6 py-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{user?.email}</p>
            <p className="text-sm text-gray-600">{user?.full_name}</p>
            <button
              onClick={signOut}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 px-4 py-3 font-medium transition-colors ${
            activeTab === 'reports'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Reports
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 px-4 py-3 font-medium transition-colors ${
            activeTab === 'upload'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Report Pothole
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'reports' ? (
          <div className="p-4 space-y-3">
            {reports.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No reports yet</p>
              </div>
            ) : (
              reports.map((report) => (
                <div key={report._id} className="bg-white border rounded-lg p-3 shadow-sm">
                  {report.image_url && (
                    <img
                      src={report.image_url.startsWith('http') ? report.image_url : report.image_url}
                      alt="Pothole"
                      className="w-full h-32 object-cover rounded mb-2"
                      onError={(e) => {
                        console.error('Image load error:', report.image_url);
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EImage not found%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  )}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Status:{' '}
                        <span
                          className={`${
                            report.status === 'verified'
                              ? 'text-green-600'
                              : report.status === 'pending'
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}
                        >
                          {report.status}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(report.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Confidence: {(report.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteReport(report._id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Pothole Image
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Take a photo with GPS enabled camera and upload it here
              </p>
              <label className="inline-block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="hidden"
                />
                <span className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 cursor-pointer inline-block">
                  {loading ? 'Processing...' : 'Choose File'}
                </span>
              </label>
              <div className="mt-4">
                <label className="inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="hidden"
                  />
                  <span className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 cursor-pointer inline-block">
                    {loading ? 'Processing...' : 'Take a Picture'}
                  </span>
                </label>
              </div>
              {uploadStatus && (
                <p
                  className={`mt-4 text-sm ${
                    uploadStatus.includes('❌')
                      ? 'text-red-600'
                      : uploadStatus.includes('⚠️')
                        ? 'text-yellow-600'
                        : 'text-green-600'
                  }`}
                >
                  {uploadStatus}
                </p>
              )}
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Instructions:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>1. Take a clear, well-lit photo of the pothole</li>
                <li>2. Use "Choose File" to upload from your device or "Take a Picture" to use your camera</li>
                <li>3. Ensure GPS data is embedded in the image</li>
                <li>4. Upload the image here</li>
                <li>5. Our AI system will detect and verify the pothole</li>
                <li>6. Once verified, the pothole will be shown on the map</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

