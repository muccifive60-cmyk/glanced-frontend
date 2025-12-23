import { useEffect, useState } from "preact/hooks";

export default function BusinessSelector({ onSelect }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3000/businesses")
      .then((res) => res.json())
      .then((data) => {
        setBusinesses(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading businesses...</p>;

  return (
    <div style={{ width: "100%", maxWidth: "420px", marginTop: "30px" }}>
      <h3>Your Businesses</h3>

      {businesses.map((biz) => (
        <div
          key={biz.id}
          onClick={() => onSelect(biz)}
          style={{
            padding: "14px",
            marginTop: "10px",
            background: "#020617",
            borderRadius: "10px",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{biz.name}</span>
          <span style={{ color: "#22c55e" }}>active</span>
        </div>
      ))}
    </div>
  );
}
