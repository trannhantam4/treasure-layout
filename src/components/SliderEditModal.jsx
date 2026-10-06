import { useState, useRef, memo } from 'react';
import { uploadImageToImgBB } from '../Event';
import { modalOverlayStyle, modalCardStyle, modalCloseBtnStyle } from '../Modal';

/**
 * Modal for Admins/Managers to customize homepage slider images.
 * Supports:
 * - Direct image file upload to ImgBB
 * - Adding image by URL
 * - Removing images
 * - Reordering images (up/down)
 * - Live preview of all images
 */
const SliderEditModal = memo(({
  isOpen,
  onClose,
  sliderTitle,
  currentImages = [],
  onSave,
  saving = false
}) => {
  const [images, setImages] = useState(() => [...currentImages]);
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const uploadedUrl = await uploadImageToImgBB(file);
      setImages((prev) => [...prev, uploadedUrl]);
    } catch (err) {
      console.error('Slider image upload error:', err);
      setError(err.message || 'Image upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }
    setImages((prev) => [...prev, trimmed]);
    setUrlInput('');
    setError('');
  };

  const handleRemove = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMove = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (images.length === 0) {
      setError('Please include at least 1 image in the slider.');
      return;
    }
    setError('');
    onSave(images);
  };

  return (
    <div style={modalOverlayStyle({ zIndex: 3000, background: 'rgba(0,0,0,0.75)', blur: 'blur(8px)' })} onClick={onClose}>
      <div
        style={{ ...modalCardStyle({ maxWidth: '560px', maxHeight: '85vh' }), display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>Edit Slider Images</h2>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              {sliderTitle}
            </p>
          </div>
          <button onClick={onClose} style={modalCloseBtnStyle} aria-label="Close">✕</button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {error && (
            <div style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: 'var(--font-xs)',
              marginBottom: 'var(--space-3)'
            }}>
              {error}
            </div>
          )}

          {/* Add Image Controls */}
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-4)'
          }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>
              ADD NEW IMAGE
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || saving}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, minWidth: '130px' }}
              >
                {uploading ? 'Uploading...' : '📁 Upload Image'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <input
                type="url"
                placeholder="Or paste image URL (https://...)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
                className="input-style"
                style={{ margin: 0, fontSize: 'var(--font-xs)', flex: 1 }}
              />
              <button
                type="button"
                onClick={handleAddUrl}
                disabled={!urlInput.trim() || saving}
                className="btn btn-secondary btn-sm"
              >
                Add URL
              </button>
            </div>
          </div>

          {/* Image List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              CURRENT SLIDES ({images.length})
            </span>
            {images.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)', padding: 'var(--space-4) 0' }}>
                No images yet. Upload or add an image URL above.
              </p>
            ) : (
              images.map((imgUrl, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', minWidth: '20px', fontWeight: 600 }}>
                    #{index + 1}
                  </span>
                  <img
                    src={imgUrl}
                    alt={`Slide ${index + 1}`}
                    style={{
                      width: '64px',
                      height: '42px',
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      backgroundColor: '#000',
                      flexShrink: 0
                    }}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/64x42?text=Error';
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block',
                      fontSize: 'var(--font-xs)',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {imgUrl}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      className="btn btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '12px' }}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === images.length - 1}
                      className="btn btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '12px' }}
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      className="btn btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '12px', color: 'var(--danger)' }}
                      title="Delete slide"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading}
            className="btn btn-secondary btn-flex"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || uploading || images.length === 0}
            className="btn btn-primary btn-flex"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default SliderEditModal;
