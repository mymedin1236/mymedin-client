import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import StarRating from "../components/StarRating";
import PublicTopbar from "../components/PublicTopbar";
import { SkeletonCards } from "../components/Skeleton";

export default function FindDoctor() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locStatus, setLocStatus] = useState("Finding doctors near you…");

  const load = async (lat, lng) => {
    setLoading(true);
    try {
      const params = lat != null && lng != null ? { lat, lng } : {};
      const { data } = await api.get("/doctors", { params });
      setDoctors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Re-detect location and reload the list (used on mount and by the Refresh button).
  const locate = () => {
    setLocStatus("Finding doctors near you…");
    if (!navigator.geolocation) {
      setLocStatus("Location unavailable — showing top-rated doctors.");
      load();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocStatus("Sorted by distance from your location.");
        load(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocStatus("Location denied — showing top-rated doctors.");
        load();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {!user && <PublicTopbar />}
      <div className="page">
      <div className="page-head">
        <h1 className="icon">
          <Icon name="person_search" /> Find a doctor
        </h1>
        <button className="btn-secondary icon" onClick={locate} disabled={loading}>
          <Icon name="refresh" size={18} /> Refresh
        </button>
      </div>
      <p className="muted">{locStatus}</p>
      {!user && (
        <p className="muted">
          Browse clinics near you, then sign in or create an account to connect with one.
        </p>
      )}

      {loading ? (
        <SkeletonCards count={6} />
      ) : doctors.length === 0 ? (
        <p className="muted">No doctors registered yet.</p>
      ) : (
        <div className="doctor-grid">
          {doctors.map((d) => (
            <div key={d._id} className="doctor-card">
              <div className="row gap" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="row gap" style={{ alignItems: "center" }}>
                  <Avatar src={d.image} name={d.name} size={52} />
                  <h3 style={{ margin: 0 }}>Dr. {d.name}</h3>
                </div>
                {d.distanceKm != null && (
                  <span className="badge icon">
                    <Icon name="near_me" size={16} /> {d.distanceKm} km
                  </span>
                )}
              </div>
              {d.clinicName && <div className="muted">{d.clinicName}</div>}
              {d.specialization && (
                <div className="tag icon">
                  <Icon name="medical_services" size={16} /> {d.specialization}
                </div>
              )}
              <div className="row gap" style={{ marginTop: 6 }}>
                <StarRating value={d.rating} size={18} />
                <span className="muted">
                  {d.rating ? d.rating.toFixed(1) : "New"}
                  {d.reviewCount ? ` (${d.reviewCount})` : ""}
                </span>
              </div>
              {d.yearsOfExperience != null && (
                <div className="muted icon">
                  <Icon name="workspace_premium" size={16} /> {d.yearsOfExperience} yrs
                  experience
                </div>
              )}
              {d.about && <p className="clamp-2">{d.about}</p>}
              <Link
                to={`/doctors/${d._id}`}
                className="btn-secondary icon"
                style={{ textDecoration: "none", marginTop: "auto" }}
              >
                <Icon name="info" size={18} /> View details
              </Link>
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  );
}
