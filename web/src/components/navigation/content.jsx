import "../../assets/css/contenido.css";
import {Button,Card} from "react-bootstrap/";
function Content({icon,title,backgroundImage,backgroundStyle }) {
  const cardStyle = {
    backgroundImage: `url(${backgroundImage})`,
 
    backgroundSize: '100%', // Incrementa este valor para reducir el "zoom" de la imagen
    backgroundPosition: 'center', 
    backgroundPositionY:"-380px",
    color: 'white',
    height:220,
    borderRadius:20
  };
  
  const contentStyle = {
    position: 'relative',  // Esto asegura que el texto esté por encima del fondo oscurecido
  };
  return (
    
  <>
  
  <div style={{ padding: "20px"}}>
    <Card style={cardStyle} className="border-0">
    <div style={backgroundStyle}></div>
    <div style={contentStyle}>
      <Card.Body>
      <div className="d-flex flex-column align-items-start" style={{marginTop:45}}>
                <div className="d-flex">
                  <i style={{color:"#fff", fontSize:32}} className={icon + "  marginl-2 "}></i>
                  <h2 className="text-white">{title}</h2>
                </div>
                
              </div>
      </Card.Body>
      </div>
    </Card>
    
</div>
</> 
  );
}
;
export default Content


