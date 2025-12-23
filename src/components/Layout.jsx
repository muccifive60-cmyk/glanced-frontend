export default function Layout({ children }) {
  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.logo}>GlanceID</h1>
      </header>

      <main style={styles.main}>
        {children}
      </main>
    </div>
  )
}

const styles = {
  app: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#e5e7eb",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid #1e293b",
    backgroundColor: "#020617",
  },
  logo: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "600",
  },
  main: {
    padding: "24px",
    maxWidth: "960px",
    margin: "0 auto",
  },
}
