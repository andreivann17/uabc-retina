import jsPDF from "jspdf";
import img from "./../../assets/img/Logo_DonSimon.png";
import React, { useState, useEffect, forwardRef,useImperativeHandle } from 'react';


  const gethour = () =>{
    let currentTime = new Date();
let hours = currentTime.getHours();
let minutes = currentTime.getMinutes();
let seconds = currentTime.getSeconds();

// Formatear los valores de hora, minutos y segundos para que tengan siempre 2 dígitos
if (hours < 10) {
  hours = '0' + hours;
}
if (minutes < 10) {
  minutes = '0' + minutes;
}
if (seconds < 10) {
  seconds = '0' + seconds;
}

return hours + ':' + minutes + ':' + seconds;
 
  }
  const gettablevertical = (doc,data,headerY,headerHeight,tipo) =>{
    const column1 = data[0]; // Datos de la columna 1
    const column2 = data[1]; // Datos de la columna 2
    const rowHeight = 10; // Altura de cada fila
    const tableX = 10; // Posición X de la tabla
    const tableY = headerY + headerHeight + ( tipo=="MAX" ? 15:5); // Posición Y de la tabla con padding
    
    doc.setFontSize(16);
    doc.setFont('bold');
    const totalWidth = doc.internal.pageSize.width - 20; // Ancho total de la tabla con padding
    const columnWidth = totalWidth * 0.3; // Ancho de la primera columna (30%)
    const columnWidth2 = tipo=="MAX" ? totalWidth * 0.7 : totalWidth * 0.35 ; // Ancho de la segunda columna (60%)
    
    doc.setFontSize(14);
    doc.setFont('normal');


    // Bucle para dibujar bordes y líneas horizontales en la columna 1
    for (let i = 0; i < column1.length; i++) {
      doc.setFillColor('#375a7f'); // Establecer color de relleno de la celda
      doc.rect(tableX, tableY + rowHeight * i, columnWidth, rowHeight, 'F'); // Dibujar rectángulo con relleno
    
      doc.setTextColor('#fff'); // Establecer color de texto en la celda
      doc.setFontSize(14); // Establecer el tamaño de fuente deseado
    
      const textHeight = doc.getTextDimensions(column1[i].toString() + ":").h; // Obtener la altura del texto
    
      doc.text(tableX + 10, tableY +4 + rowHeight * i + (rowHeight - textHeight) / 2, column1[i].toString() + ":"); // Escribir texto en la celda
    
      // Restablecer colores a los valores predeterminados
      doc.setFillColor('#000'); // Color de relleno predeterminado
      doc.setTextColor('#000'); // Color de texto predeterminado
    
      // Dibujar bordes de la celda
      doc.rect(tableX, tableY + rowHeight * i, columnWidth, rowHeight, 'S');
      doc.line(tableX, tableY + rowHeight * (i + 1), tableX + columnWidth, tableY + rowHeight * (i + 1));
    }
    
    // Bucle para dibujar bordes y líneas horizontales en la columna 2
   
    for (let i = 0; i < column1.length; i++) {
      console.log(column2[i])
      doc.rect(tableX + columnWidth, tableY + rowHeight * i, columnWidth2, rowHeight, 'S');
    
      doc.setFontSize(14); // Establecer el tamaño de fuente deseado
    
      const textHeight = doc.getTextDimensions(column2[i].toString()).h; // Obtener la altura del texto
    
      doc.text(tableX + columnWidth + 10, tableY +4 + rowHeight * i + (rowHeight - textHeight) / 2, column2[i].toString()); // Escribir texto en la celda
    }
    
return doc
  }
  const gettablehorizontal = (doc,data,headerY,headerHeight) =>{

    doc = gettablevertical(doc,data[2],headerY,headerHeight,"MIN")
    
    let num = data[2][0].length *20 
     const datacontent = data[1][0];
    
      let columns =data[0];
    
      columns = columns.filter(function(elemento) {
        return elemento !== undefined;
      });
      
  
      const tableX = 10;
    const tableY = headerHeight + 70;
    const tableWidth = doc.internal.pageSize.width * 0.93;
    const columnWidth = tableWidth / columns.length;
    const rowHeight = 10;
   
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);

    // Dibujar encabezado de la tabla
    doc.setFillColor(55, 90, 127);
    doc.rect(tableX, tableY, tableWidth, rowHeight, 'F');

    // Escribir nombres de columnas
    doc.setFont('helvetica', 'bold');
    console.log(columns)
    for (let i = 0; i < columns.length; i++) {
      if(typeof columns[i]!="undefined"){
        const columnX = tableX + i * columnWidth + 5;
        doc.text(columnX, tableY + 7, columns[i]);
      }
     
    }
    
    // Dibujar contenido de la tabla
    doc.setFont('helvetica', 'normal');
    doc.setFillColor(255, 255, 255);
    doc.setTextColor(0, 0, 0);
    for (let i = 0; i < datacontent.length; i++) {
      const rowData = datacontent[i]
      const startY = tableY + rowHeight * (i + 1);
      
      for (let j = 0; j < columns.length; j++) {
        if(typeof columns[j]!="undefined" ){
          const columnX = tableX + j * columnWidth;
          doc.rect(columnX, startY, columnWidth, rowHeight, 'S');
          doc.text(columnX + 5, startY + 7, rowData[j].toString());
        }

      }
    }
  
  
      // Guardar el documento PDF
  
    return doc
  }
  const gettableverticalx2 = (doc,data,headerY,headerHeight) =>{

    doc = gettablevertical(doc,data[2],headerY,headerHeight,"MIN")
    doc = gettablevertical(doc,data,headerY,headerHeight + 30,"MAX")
    return doc
  }
const exportar = (title,type,data) =>{
  let doc;

  if (type === "TABLE_HORIZONTAL") {
    doc = new jsPDF({
      orientation: "landscape", // Establecer la orientación a "landscape" para una página horizontal
    });
  } else {
    doc = new jsPDF(); // Utilizar la orientación predeterminada (vertical) para otros tipos
  }

  const headerHeight = 30;
  const imgWidth = 35;
  const imgHeight = 20;
  const headerX = 10;
  const headerY = 10;
  const headerImg = new Image();
  headerImg.src = img; // Reemplaza 'ruta_de_la_imagen' con la ruta correcta de la imagen
  let currentDate = new Date().toLocaleDateString() + " " + gethour();
  const infoType = title;
  // Dibujar el encabezado
  doc.setFontSize(14);
  doc.setFont('bold'); // Ajustar la coordenada X y Y del texto del nombre de la empresa
  doc.setFontSize(10);
doc.text(doc.internal.pageSize.width - headerX, headerY  + 15 / 2 , `${currentDate} `, 'right');
 // Ajustar la coordenada X y Y del texto de la ciudad y fecha
  doc.setFontSize(20);
  doc.setFont('bold');
  doc.text(doc.internal.pageSize.width / 2, headerY + 15  / 2, infoType, 'center');
    doc.addImage(
      headerImg,
      'PNG',
      headerX, // Coordenada X de la imagen sin cambios
      headerY - 5 , // Coordenada Y de la imagen sin cambios
      imgWidth,
      imgHeight
    );

  if (type=="TABLE_VERTICAL"){
    doc = gettablevertical(doc,data,headerY,headerHeight,"MAX")
  }else if (type=="TABLE_HORIZONTAL"){
    doc = gettablehorizontal(doc,data,headerY,headerHeight)

  }else if (type=="TABLE_VERTICALx2"){
    doc = gettableverticalx2(doc,data,headerY,headerHeight)
  }
    

    doc.save('my-document.pdf');
  

  }
  const home = React.forwardRef(({},ref) => {
    useImperativeHandle(ref, () => ({
        exportar: (title,type,data) =>{
     
            exportar(title,type,data)
         
        },
       
      }));
    return(
        <></>
    )
})
  export default home