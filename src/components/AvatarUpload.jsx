import { useRef, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import api from "../api/axios";
import Icon from "./Icon";
import Avatar from "./Avatar";

// Load an image element from a data URL (used by the canvas cropper).
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = url;
  });

// Render the chosen crop area to a square canvas and return a JPEG data URL.
async function getCroppedDataUrl(src, cropPixels, size = 512) {
  const image = await createImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    size,
    size
  );
  return canvas.toDataURL("image/jpeg", 0.9);
}

// Photo picker with an in-place crop/zoom/position editor. Uploads the final
// square to Cloudinary via the server and reports back the hosted URL.
//
// Props:
//   value    - current image URL (or empty)
//   onChange - called with the new hosted URL after a successful upload
export default function AvatarUpload({ value, name = "", onChange, centered = false, hint = "" }) {
  const fileRef = useRef(null);
  const [rawImage, setRawImage] = useState(null); // data URL being edited
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedPixels(areaPixels);
  }, []);

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRawImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const cancelEdit = () => {
    setRawImage(null);
    setError("");
  };

  const save = async () => {
    if (!croppedPixels) return;
    setUploading(true);
    setError("");
    try {
      const dataUrl = await getCroppedDataUrl(rawImage, croppedPixels);
      const { data } = await api.post("/uploads/avatar", { image: dataUrl }, { skipLoader: true });
      onChange?.(data.url);
      setRawImage(null);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`avatar-upload${centered ? " centered" : ""}`}>
      <Avatar src={value} name={name} size={centered ? 104 : 88} />
      <div className="avatar-upload-actions">
        <button type="button" className="btn-secondary icon" onClick={() => fileRef.current?.click()}>
          <Icon name={value ? "photo_camera" : "add_a_photo"} size={18} />
          {value ? "Change photo" : "Upload photo"}
        </button>
        {value && (
          <button type="button" className="btn-link icon" onClick={() => onChange?.("")}>
            <Icon name="delete" size={16} /> Remove
          </button>
        )}
        {hint && (
          <span className="muted" style={{ fontSize: 12 }}>{hint}</span>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={pickFile}
        style={{ display: "none" }}
      />

      {rawImage && (
        <div className="modal-backdrop" onClick={cancelEdit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="icon"><Icon name="crop" size={18} /> Adjust your photo</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={cancelEdit}>
                <Icon name="close" />
              </button>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Drag to position, and use the slider to zoom.
            </p>
            {error && <div className="error">{error}</div>}
            <div className="cropper-stage">
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <label className="cropper-zoom icon">
              <Icon name="zoom_out" size={18} />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom"
              />
              <Icon name="zoom_in" size={18} />
            </label>
            <div className="row gap">
              <button type="button" className="icon" onClick={save} disabled={uploading}>
                <Icon name="check" size={18} /> {uploading ? "Uploading…" : "Use photo"}
              </button>
              <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={uploading}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
