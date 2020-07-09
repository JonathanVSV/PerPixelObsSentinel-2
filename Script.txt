/*
Descripción general:
Este script permite realizar consultas del número de observaciones válidas por pixel (una vez aplicada la máscara 
de nubes) para las distintas ecorregiones del país. El número de observaciones válidas es equivalente al 
número de observaciones válidas registradas con una diferencia mayor a un día sobre una misma superficie.

El script tiene cinco secciones: 
   1. Definición de variables por el usuario.
   2. Definición de funciones.
   3. Construcción de mosaicos y tablas
   4. Exportar mosaicos y tablas
   5. Consultar y exportar metadatos de las imágenes
   
El script permite exportar tres tipos de resultados:
   1. Tablas de frecuencia de pixeles por número de observaciones válidas por Ecorregión.
      Se exportan dos tablas, una mensual y una anual por ecorregión (Sentinel-2_1C_ValidObs_Year2015-01-01-2019-12-31_
      Histogram y Sentinel-2_1C_ValidObs_Month2015-01-01-2019-12-31_Histogram). 
      Las tablas mensuales contienen la información de cada mes en todo el periodo de estudio.
      Las tablas anuales concentran la información de cada año en el periodo de estudio.
   2. Imágenes mensuales y anuales del número de observaciones válidas para todo el país.
      Se exportan dos tipos de imágenes: mosaicos anuales y mensuales. 
      (S2_1C_MXjDayVObs_"Año"_60m y S2_1C_MXjDayVObs_"Año"_Month"mes"_60m)
      Las imágenes mensuales contienen la información de cada mes en todo el periodo de estudio. 
      Debido al enorme número de imágenes mensuales posibles, en la versión actual hay que indicar el año del que
      se desean exportar las imágenes mensuales.
      Las imágenes anuales concentran la información de cada año en el periodo de estudio.
   3. Metadatos de las imágenes para el país 
      Se exporta una sola tabla con los metadatos de las imágenes que cubren al país.
      (Sentinel-2_1C_Metadata_2015-2019)
      Esta tabla contiene todos los metadatos de todas las imágenes en el periodo de estudio.
*/

//1. 
//------------------Definición de variables-----------------------------------
  //folder de Google Drive donde se van a guardar los resultados
  var folder = 'Sentinel-2_2A_MX_Ecorregions_Histogram_60m';
  
  //
  var prueba = MX2, //poligono del área de interés, en este caso el polígono de México
      //Este polígono se puede subir como Asset directamente en GEE
      area = geometry2, // gemometría sencilla que englobe la superficie del polígono del área de interés
      //Este polígono se puede trazar directamente la interfaz de GEE
      Ecor = Ecorregiones, //Información vectorial con las ecorregiones de interés
      resolution = 60, //Tamaño de pixel en m; banda QA60 = 60 m 
      
      //Evaluaciones 
      mStart = 2015, //Año inicial para las evaluaciones mensuales
      mEnd = 2020, //Año final para las evaluaciones mensuales
      yStart = '2015-07-01',//Fecha inicial para las evaluaciones mensuales
      yEnd = '2020-01-01',//Fecha final para las evaluaciones mensuales
      yTot = mEnd - mStart, // Total de años a evaluar
      annualStart = '2015-07-01', //Fecha inicial para las evaluaciones anuales
      annualEnd = '2020-01-01',//Fecha final para las evaluaciones anuales
      yearExp = '2019',//Año del cual se van a exportar los mosaicos mensuales
      
      //Información del polígono de ecorregiones a utilizar para resumir frecuencias
      //En este caso el campo a utilizar del polígono de interés se llama CVEECON1 y va del 9 al 15
      //Si se cambia el polígono a utilizar se debe cambiar estos valores así como el nombre del campo
      //a utilizar para la consulta (cambiar también en la función 2.6 reduceRegionMeanWrap) 
      CVEinit = 9, //Código inicial en el campo de CVEECON1 en el FeatureCollection de Ecorregiones
      CVEfinit = 15; //Código final en el campo de CVEECON1 en el FeatureCollection de Ecorregiones
    
//2.
//-------------------Definición de funciones-----------------------------------
//2.1 Cortar la información a los polígonos de interés
  //Cortar con polígono sencillo
  var corte = function(image){
    return image.clip(area);
  };
  //Cortar con polígono del área de interés (en este caso México)
  var corteMX = function(image){
    return image.clip(prueba);
  };

//2.2 Función para generar el número de observaciones válidas por pixel
  //Función que genera el número de observaciones válidas por pixels con base en el día juliano
  //en el que fue registrada la observación
  var qaCount = function(image){
    var qa = image.select('QA60');
    var NIR = image.select('B4');
    var validObs = qa.eq(0);
    validObs = validObs.updateMask(NIR);
    validObs = validObs.rename('QA');

    var jDay = image.get('system:time_start');
    jDay = ee.Image.constant(ee.Number.parse(ee.Date(jDay).format('D')));
    jDay = jDay.updateMask(validObs);
    jDay = jDay.rename('julianDay');

    var resul = jDay;
    resul = resul.floor();
    resul = resul.toUint16();
    return resul; 
  };
  
//2.3 Reducción de la colección a una sola imagen
  //Función para contar el número de observaciones válidas realizadas en distintos días
  var reductionTable = function(collection1, extraDate){
      var julDay = collection1.select('julianDay').reduce(ee.Reducer.countDistinct());
      var julDayZero = collection1.map(function(image){
        return image.unmask({value:0});
      });
      julDayZero =julDayZero.select('julianDay').reduce(ee.Reducer.min());
      
      julDayZero = julDayZero.lte(0);
      julDay = julDay.subtract(ee.Image(julDayZero));
      
      julDay = julDay.unmask({value:0});
      julDay = julDay.rename('julianDay_ValidObs');
      var resul = julDay;
      resul = corteMX(resul);
      
      resul = resul.floor();
      resul = resul.toUint16();
      resul = resul.set('Fecha',ee.Date(extraDate).format('Y-M-d'));
      
      return resul;  
  };

// 2.4 Generadores de fechas
  //Transformar lista de meses a fechas
  var dateGen = function (num){ 
    return ee.Date(yStart).advance(num,'month'); 
  };
  //Transformar lista de años a fechas
  var dateGenYear = function (num){ 
    return ee.Date(annualStart).advance(num,'year'); 
  };

// 2.5 Filtrado de la colección
  //Filtrado mensual
  var monthFilter2 = function(date){
      var endDate = ee.Date(date).advance(1,'month'); 
      var extraDate = ee.Date(date);
      
      var collection1 = Sentinel2_2A
          .filterDate(date,endDate)
          .filterBounds(area)
          .select(['QA60','B4']);
      collection1 = collection1 
          .map(corte)
          .map(qaCount);
            
      var emptyColl = ee.Image.constant(0).clip(area).rename('julianDay_ValidObs');
      var temp = ee.ImageCollection(collection1).size();
      var imRed = ee.Algorithms.If(ee.ImageCollection(collection1).size().gte(1),
                                    reductionTable(ee.ImageCollection(collection1),extraDate), 
                                    emptyColl);

      var resul = imRed;
      return resul;
  };
  
  //Filtrado anual
  var yearFilter2 = function(date){
      var endDate = ee.Date(date).advance(1,'year'); 
      var extraDate = ee.Date(date);

      var collection1 = Sentinel2_2A
          .filterDate(date,endDate)
          .filterBounds(area)
          .select(['QA60','B4']);
      collection1 = collection1 
          .map(corte)
          .map(qaCount);
            
      var emptyColl = ee.Image.constant(0).clip(area).rename('julianDay_ValidObs');
      var temp = ee.ImageCollection(collection1).size();
      var imRed = ee.Algorithms.If(ee.ImageCollection(collection1).size().gte(1),
                                    reductionTable(ee.ImageCollection(collection1),extraDate), 
                                    emptyColl);
      
      var resul = imRed;
      return resul;
    
  };

//2.6 Reducción de las imágenes por ecorregión. Generación de información de histograma
  //Obtención de frecuencias de observaciones válidas por ecorregión
  var reduceRegionMeanWrap = function(n, featEcor) {
    var reduceRegionMean = function(image){
       
        //Número de cajas para obtener el histograma
        var maxBin = ee.Number(n).multiply(15);
        var maxNBin = (ee.Number(n).multiply(15)).add(1);
        
        var resul2 = ee.Image(image.select('julianDay_ValidObs')).reduceRegion({
          reducer:ee.Reducer.fixedHistogram(-1, maxBin, maxNBin),
          geometry: featEcor, 
          scale: ee.Number(resolution).int(), 
          maxPixels:1e12, 
          tileScale:4
          });
      
          resul2 = ee.Feature(null, resul2);
          resul2 = resul2.set({'Fecha': image.get('Fecha'),
            'CVEECON1':ee.Feature(featEcor.first()).get('CVEECON1'),
            'DESECON1':ee.Feature(featEcor.first()).get('DESECON1')
          });

        return resul2; 
      };
      
  return reduceRegionMean;
};

//2.7 Obtención de información de los metadatos de las imágenes
  var consulta = function(image) {
    var id = ee.String(image.get('PRODUCT_ID'));
    var CloudCover = image.get('CLOUDY_PIXEL_PERCENTAGE');
    var CloudCoverLand = image.get('CLOUD_COVERAGE_ASSESSMENT');
    var date = ee.Date(image.get('system:time_start'));
    var sensor = ee.String(image.get('SPACECRAFT_NAME'));
    var mgrsTile = ee.Number(image.get('MGRS_TILE'));
    
    var dictionarySummary = ee.Dictionary({
          ID: id,
          cloud_pixel_percentage: CloudCover,
          cloud_coverage_assessment: CloudCoverLand,
          date: date,
          sensor: sensor,
          mgrsTile: mgrsTile, 
          
          });
          
    var SummaryFeature = ee.Feature(null,dictionarySummary);
    return SummaryFeature;
  };

//2.8 Funciones exporatadoras
  //Exportar imágenes 
    //Mensuales
    var exportImageMonth = function(image,month,resolution){
      Export.image.toDrive({
                  image: image,
                  description: 'S2_1C_MXjDayVObs_2019_Month'+month.toString()+'_'+resolution.toString()+'m',
                  scale: resolution,
                  folder: folder,
                  crs: 'EPSG:4326',
                  maxPixels:1e12,
                  region: area
                });
    };
    //Anuales
    var exportImageYear = function(image,year,resolution){
      Export.image.toDrive({
                  image: image,
                  description: 'S2_1C_MXObs_'+year.toString()+'_'+resolution.toString()+'m',
                  scale: resolution,
                  folder: folder,
                  crs: 'EPSG:4326',
                  maxPixels:1e12,
                  region: area
                });
    };


  //Exportar tablas
    //Mensuales
    var exportMeansMonth = function(table, CVE, nM){
     Export.table.toDrive({
          collection: table,
          description: 'Sentinel-2_1C_ValidObs_CVE'+CVE.toString()+'_'+nM.toString()+'MonthComp_'+yStart+'-'+yEnd+'_Hist',
          folder: folder,
          fileFormat: 'CSV',
          //Hay que definir las columnas a exportar para forzar que no quite algunas
          selectors: ['Fecha','CVEECON1','DESECON1','julianDay_ValidObs']
        });
    };
    //Anuales
    var exportMeansYear = function(table, CVE){
     Export.table.toDrive({
          collection: table,
          description: 'Sentinel-2_1C_ValidObs_CVE'+CVE.toString()+'_YearComp_'+annualStart+'-'+yEnd+'_Histogram',
          folder: folder,
          fileFormat: 'CSV',
          //Hay que definir las columnas a exportar para forzar que no quite algunas
          selectors: ['Fecha','CVEECON1','DESECON1','julianDay_ValidObs']
        });
    };

    //Exportar información de metadatos
    var exportMetadata = function(table,y1,y2){
     Export.table.toDrive({
          collection: table,
          description: 'Sentinel-2_1C_Metadata_'+y1+
                      '-'+y2,
          folder: folder,
          fileFormat: 'CSV'
        });
    };

//3
//----------------Contruir mosaicos y tablas-----------------------
  //3.1 Tabla mensual (histogramas)

    var monthlySeq = ee.List.sequence(0,(12*(yTot+1)-7),1); 
    
    //Transformar lista numérica a fecha
    var datesList = monthlySeq.map(dateGen); 
    
    //Construir mosaicos mensuales
    var meanFeatureCol = datesList.map(monthFilter2);
    
    //Crear una colección de imágenes a partir de los mosaicos mensuales
    var expImColl = ee.ImageCollection.fromImages(meanFeatureCol);
    
    //Ciclo para exportar las tablas mensuales por ecorregión
    var i = CVEinit;
    for(;i<=CVEfinit;i++){
      
      var featEcor = Ecor.filter(ee.Filter.eq('CVEECON1',i));
      //Calcular histogramas para cada imagen
      var expResul = expImColl.map(reduceRegionMeanWrap(1,featEcor));
  
      //Exportar
      exportMeansMonth(expResul, i, 1);
    }

  //3.2 Tabla anual (histogramas)
    
    var yearlySeq = ee.List.sequence(0,yTot,1); 
    
    //Transformar lista numérica a fecha
    var datesListYear = yearlySeq.map(dateGenYear);
    
    //Construir mosaicos anuales
    var meanFeatureColYear = datesListYear.map(yearFilter2);
    
    //Crear una colección de imágenes a partir de los mosaicos anuales
    var expImCollYear = ee.ImageCollection.fromImages(meanFeatureColYear);
    
    //Ciclo para exportar las tablas anuales por ecorregión
    i = CVEinit;
    for(;i<=CVEfinit;i++){
      
      var featEcor = Ecor.filter(ee.Filter.eq('CVEECON1',i));
      //Calcular histogramas para cada imagen
      var expResul = expImCollYear.map(reduceRegionMeanWrap(12,featEcor));
  
      //Exportar
      exportMeansYear(expResul, i);
    
    }

//4 
//----------------Exportar imágenes--------------------------------------
  //Exportar las imágenes anuales en un ciclo
    var i = 0;
    for(;i<=yTot;i++){
      var currYear = mStart + i;
 
      var yearIm = expImCollYear.filter(ee.Filter.eq('Fecha',currYear.toString()+'-1-1'));

      yearIm = yearIm.first();
 
      yearIm = yearIm.select('julianDay_ValidObs');

      yearIm = yearIm.floor().toUint16();
    
      exportImageYear(yearIm,currYear,resolution);
    }

  //Exportar las imágenes mensuales en un ciclo 
  //En la actual versión sólo exporta las imágenes del año que se indique en la variable yearExp
    var i = 0;
    
    for(;i<=11;i++){
      
      var month = 1+i;
      var expImage = expImColl.filter(ee.Filter.eq('Fecha',yearExp+'-'+month.toString()+'-1'));
      expImage = ee.Image(expImage.first());
      
      expImage = expImage.select('julianDay_ValidObs');
      expImage = expImage.floor().toUint16();

      exportImageMonth(expImage,month,resolution);
    }

//5
//-----------------Exportar tabla de metadatos----------------------
  var S2_1CMeta = Sentinel2_2A
      .filterDate(mStart.toString()+'-01-01',mEnd.toString()+'-12-31')
      .filterBounds(prueba)
      .select('QA60');
      
  var S2_1CExp = ee.FeatureCollection(S2_1CMeta.map(consulta));
  
  exportMetadata(S2_1CExp,mStart,mEnd);
