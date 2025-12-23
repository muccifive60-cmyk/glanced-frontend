export default function BusinessList({ businesses, onSelect }) {
  return (
    <div style={wrapper}>
      <h2>Your Businesses</h2>

      {businesses.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No businesses found</p>
      ) : (
        businesses.map((biz) => (
          <div
            key={biz.id}
            style={card}
            onClick={() => onSelect(biz)}
          >
            <strong>{biz.name}</strong>
            <span style={status}>● {biz.status}</span>
          </div>
        ))
      )}
    </div>
  );
}

/* styles */
const wrapper = {
  width: "100%",
  maxWidth: "400px",
  marginTop: "30px",
};

const card = {
  background: "#0b2238",
  padding: "15px",
  borderRadius: "10px",
  marginTop: "10px",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const status = {
  fontSize: "12px",
  color: "#4ade80",
};
