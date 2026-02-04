import React, { useState,useImperativeHandle, useEffect } from 'react';
import "../../assets/css/header.css";
import {Button} from "react-bootstrap/";
import {connect} from "react-redux"
const Header =({children, title,icon,scroll}) => {
  const [headerStyle,setHeaderStyle] = useState({})
  const [titleStyle,setTitleStyle] = useState({})
  useEffect(() => {    
    if (scroll > 100) {      
      setHeaderStyle(
       {
         display: 'block',
         backgroundColor: '#333',
         WebkitBoxShadow: '0px 0.5px 12px 0px rgba(0,0,0,0.75)',
         MozBoxShadow: '0px 0.5px 12px 0px rgba(0,0,0,0.75)',
         boxShadow: '0px 0.5px 12px 0px rgba(0,0,0,0.75)'
       }
      )
      setTitleStyle(
       {
         opacity: 1,
         WebkitTransition: 'opacity 0.3s'
       }
      )
        
        }       
        else
        if (scroll > 50 && scroll <= 100) { 
         setHeaderStyle(
           {
             display: 'block',
             backgroundColor: '#333333b6',
             WebkitBoxShadow: '0px 0.5px 12px 0px rgba(0,0,0,0.75)',
             MozBoxShadow: '0px 0.5px 12px 0px rgba(0,0,0,0.75)',
             boxShadow: '0px 0.5px 12px 0px rgba(0,0,0,0.75)'
           }
          )
          setTitleStyle(
           {
             opacity: 0,
             WebkitTransition: 'opacity 0.3s'
           }
          )
             
          
        }
        else
        if(scroll <= 60) {
      
         setHeaderStyle(
           {
             display: 'block',
             backgroundColor: 'transparent',
      
           }
          )
          setTitleStyle(
           {
             opacity: 0,
             WebkitTransition: 'opacity 0.3s'
           }
          )
            
        }
  }, [scroll]);
 
  return (
    <div  className={  'Panel_Arriba'}  style={headerStyle}>
      <div style={titleStyle} className="div_titulopanela">
        <div className="d-flex justify-content-start  align-items-center">
          <i style={{color:"#fff", fontSize:22}} className={icon + "  marginl-2 "}></i>
          <h4 className="margint-1 marginl-2 titulopanelss marginr-2 text-white">
            {title}  
          </h4>
          <div className="div_btnguardarssvd">
          {children}
          </div>
        </div>
      </div>
      
    </div>
  );
}


const mapStateToProps = (state) => ({
  scroll: state.utils.scroll ?? 0,
});

export default connect(mapStateToProps)(Header);