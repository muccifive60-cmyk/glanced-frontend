export default function Sidebar() {
 return (
   <aside
     style={{
       width: 220,
       background: "#111",
       color: "#fff",
       padding: 20,
     }}
   >
     <h3 style={{ marginBottom: 20 }}>GlanceID</h3>

     <ul style={{ listStyle: "none", padding: 0, lineHeight: "2rem" }}>
       <li>Dashboard</li>
       <li>Business</li>
       <li>Plan</li>
       <li>Features</li>
       <li>Usage</li>
       <li>Settings</li>
       <li>Audit Logs</li>
     </ul>
   </aside>
 );
}
