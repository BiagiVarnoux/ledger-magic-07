import React from "react";
import { Link } from "react-router-dom";

const NavBar: React.FC = () => {
  return (
    <nav className="p-4 flex gap-4 border-b">
      <Link to="/accounts" className="text-blue-600 hover:underline">Accounts</Link>
      <Link to="/journal" className="text-blue-600 hover:underline">Journal</Link>
      <Link to="/ledger" className="text-blue-600 hover:underline">Ledger</Link>
      <Link to="/reports" className="text-blue-600 hover:underline">Reports</Link>
    </nav>
  );
};

export default NavBar;
