export default function DashboardLayout({ children }) {
 return (
   <div
     style={{
       display: "flex",
       height: "100vh",
       fontFamily: "Arial, sans-serif",
     }}
   >
     {children}
   </div>
 );
}
