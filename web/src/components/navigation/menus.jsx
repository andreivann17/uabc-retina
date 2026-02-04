import React, { useState, useEffect, useRef } from "react";
import "./../../assets/css/menu.css";
import "./../../assets/css/utils.css";
import "./../../assets/css/fontawesome-free-6.1.0-web/css/all.css";
import "./../../assets/css/fontawesome-free-6.1.0-web/css/all.min.css";
import { useNavigate } from "react-router-dom";
import logo from "./../../assets/img/logo2.png";
import { Collapse,OverlayTrigger,Popover } from "react-bootstrap/";
import { connect } from "react-redux";

const icons = [ "fas fa-calendar", 'fas fa-file','fas fa-chart-line', 'fas fa-user', 'fas fa-cogs']
const botones = [
  [["Agenda", "/agenda"],[]],
  [["Expedientes", "/expedientes"], []],
  [["Estadisticas", '/estadisticas'], []],
  [["Usuarios", '/usuarios'], []],
  [["Ajustes", "/ajustes"],[]],
]

function Nabvar({ valuenav, privilegios, infoUser,dataLogin }) {
  console.log(privilegios)
  console.log(valuenav)
  const navegate = useNavigate();
  const [activeButton, setActiveButton] = useState(0);
  const [activeButton2, setActiveButton2] = useState(0);
  const [open, setOpen] = useState(Array(botones.length).fill(false));
  const [showPopover, setShowPopover] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [token,setToken]  = useState(localStorage.getItem("tokends"))

  useEffect(() => {
    // Agregar controlador de eventos al documento para detectar clics fuera del popover y del botón
    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowPopover(false);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      // Remover el controlador de eventos al desmontar el componente
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  const handleButtonClick = () => {
    setShowPopover(!showPopover);
  
  };
  const log_out_click = () =>{
    localStorage.removeItem("tokends");
    console.log(localStorage.getItem("tokends")); 
    navegate("/login");

  }
  const onState = (pos, subpos, url) => {

    if (url === "-") {
      let newdata = [...open];
      newdata[pos] = !newdata[pos];
      setOpen(newdata);
      setActiveButton2(-1);

    } else {
      // Reinicia el botón activo principal cuando no hay subelementos

      navegate(url);

      setActiveButton(pos);
      setActiveButton2(subpos);


    }

  };

  useEffect(() => {
    setActiveButton(parseInt(valuenav));
  }, [valuenav]);

  return (
    <>

      {token == null && (

        <div className="div-navbar" style={{ background: "#0b1b2b" }} >
          

          <div className="w-100 margint-5">
            {botones.map((value, index) => {

              if (parseInt(privilegios[index]) > 0) {
                return (
                  <>
                    <button
                      className={`w-100 d-block btn custom-button text-white border-0 ${activeButton === index ? "active" : ""}`}
                      style={{
                        height: "50px",
                        borderRadius: "0px",
                        textAlign: "start",
                      }}
                      aria-controls="example-collapse-text"
                      aria-expanded={open[index]}
                      onClick={() => onState(index, "-1", value[0][1])}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="d-flex div-navbar-buttons" >
                            <i style={{ fontSize: "20px" }} className={icons[index] + " marginr-1"}></i>
                            <h6>{value[0][0]}</h6>
                          </div>
                        </div>
                        {
                          value[1].length > 0 &&
                          <div className="icon-collapse">
                            {
                              open[index] ? <span class="material-symbols-outlined">
                                expand_more
                              </span> : <span class="material-symbols-outlined">
                                chevron_right
                              </span>
                            }
                          </div>
                        }
                      </div>
                    </button>

                    {value[1].length > 0 && (
                      <Collapse in={open[index]}>
                        <div>
                          {value[1].map((value2, index2) => (
                            <button
                              className={`w-100 btn-success btn d-block text-white border-0 ${(activeButton2 === index2 && activeButton === index) ? "active" : ""}`}
                              onClick={() => onState(index, index2, value2[1])}
                              style={{
                                height: "40px",
                                borderRadius: "0px",
                                textAlign: "start",
                              }}
                            >
                              <div className="marginl-3 div-navbar-buttons">
                                <h6>{value2[0]}</h6>
                              </div>
                            </button>
                          ))}
                        </div>
                      </Collapse>
                    )}
                  </>
                );
              } else {
                return null;
              }
            })}
          </div>

        </div>

      )}
    </>
  );
}

const mapStateToProps = (state) => ({
  botones: state.menus.botones ?? [],
  dataLogin:state.login.login?? [],
  privilegios: state.menus.privilegios ?? [2, 2,2,2,2,2],
  infoUser: state.menus.infoUser ?? { id: "0", nombre: "Andre Herrera", img: logo }
});

export default connect(mapStateToProps)(Nabvar);
