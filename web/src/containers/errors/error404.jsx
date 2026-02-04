import React, { useState } from "react";
import { Image } from "react-bootstrap/";

//import {actionDivisas,actionEditar} from "../../redux/actions/divisas/divisas.js"
import { useEffect } from "react";
import { useDispatch, connect } from "react-redux";
const token = localStorage.getItem("tokends");
function Home({}) {
  const [msg, setMsg] = useState("");
  const [showtoast, setShowToast] = useState(false);

  useEffect(() => {
    // dispatch(actionDivisas())   style={{width:"calc(100vw - 60px)"}}
  }, []);
  return (
    <div className="w-100" style={{background:"#0591cf"}}> 
      {token != null && (
        <div className="d-flex justify-content-center" style={{background:"#0591cf"}}>
         
        </div>
      )}
    </div>
  );
}

const mapStateToProps = (state) => ({});

export default connect(mapStateToProps)(Home);
