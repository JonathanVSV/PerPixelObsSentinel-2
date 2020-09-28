/*
This script gets the available cloudless number of observations at a pixel level for different ecorregions. 
The number of valid observations corresponds to observations made with a difference of more than one day over 
the same surface.

The script has 5 sections: 
  1. Variable definition.
  2. Function definition.
  3. Mosaic and table construction.
  4. Export.
  5. Image's metadata information

The script lets you export three types of results: 
  1. Tables of the frequency of pixels by number of valid observation per Ecorregion.
      Two tables can be exported, infromation at annual intervals or monthly (*_Histogram).
      The montly tables contain the information for every month in the study period, while
      annual tables concentrate the information for each year.
  2. Annual and monthly images.
      Again, two types of images can be exported: annual and monthly.
      Due to the enormous number of monthly images, in the current version, the user must 
      indicate the year for which the monthly images will be exported.
  3. Image's metadata.
      A single table is exported that contains the metadata information of all the images
      included using the spatial and temporal filters.
*/

//1. 
//------------------Definición de variables-----------------------------------
  //Folder to where the results are goin to be exported
  var folder = 'Sentinel-2_2A_MX_Ecorregions_Histogram_60m';
  
  //
  var prueba = MX2, //Polygon of the region of interest
      area = geometry2, // Bounding box of the region of interest
      Ecor = Ecorregiones, //Ecorregions shapefile, can be imported using Assets
      resolution = 60, //Pixel size in m 
      
      //Dates info
      mStart = 2015, //Initial year
      mEnd = 2020, //Final year
      yStart = '2015-07-01',//Initial date for monthly evaluations
      yEnd = '2020-01-01',//Final date for monthly evaluations
      yTot = mEnd - mStart, //Number of years that are going to be evaluated
      annualStart = '2015-07-01', //Initial date for annual mosaics
      annualEnd = '2020-01-01',//Final date for annual mosaics
      yearExp = '2019',//Year for which the monthly mosaics are going to be exported
      
      //Properties of the Ecor shapefile that are going to differentiate each Ecoregion,
      //In this case the property is named CVEECON1 and contains numbers from 9 - 15.
      //Thus, these variables indicate the initial and final value of the CVEECON1 property.
      CVEinit = 9, 
      CVEfinit = 15; 
    
//2.
//-------------------Functions-----------------------------------
//2.1 Clip the infomation to the region of interest
  //Clip with the bounding box
  var corte = function(image){
    return image.clip(area);
  };
  //Clip with the region of interest polygon
  var corteMX = function(image){
    return image.clip(prueba);
  };

//2.2 Function that generates the number of valid observations
  //Maps the julian day of the acquisition date as an image.
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
  
//2.3 Reduce the image collection to a single image
  //Function to obtain the number of cloudless observations acquired in different dates
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

// 2.4 Dates generators
  //Transform the month list into dates
  var dateGen = function (num){ 
    return ee.Date(yStart).advance(num,'month'); 
  };
  //Transform the year list into dates
  var dateGenYear = function (num){ 
    return ee.Date(annualStart).advance(num,'year'); 
  };

// 2.5 Image collection filtering
  //Monthly filter
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
  
  //Annual filter
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

//2.6 Reducing the images by ecoregion. Generating pixel's frequency by number of valid observations
  // Function to obtain the number of valid observations by ecoregion.
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

//2.7 Function to obtain the images' metadata
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

//2.8 Exporting functions
  //Export images
    //Monthly
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
    //Annual
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


  //Export tables
    //Monthly
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
    //Annual
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

    //Export metadata information
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
//----------------Build mosaics and tables-----------------------
  //3.1 Monthly tables (frequency of pixels by number of valid observations)

    var monthlySeq = ee.List.sequence(0,(12*(yTot+1)-7),1); 
    
    //Numeric list to dates list
    var datesList = monthlySeq.map(dateGen); 
    
    //Build monthly mosaics
    var meanFeatureCol = datesList.map(monthFilter2);
    
    //Create an image collection from the monthly mosaics
    var expImColl = ee.ImageCollection.fromImages(meanFeatureCol);
    
    //Loop to export the monthly info as tables by ecoregion
    var i = CVEinit;
    for(;i<=CVEfinit;i++){
      
      var featEcor = Ecor.filter(ee.Filter.eq('CVEECON1',i));
      //Calculate frequency of pixels by number of valid observations
      var expResul = expImColl.map(reduceRegionMeanWrap(1,featEcor));
  
      //Export
      exportMeansMonth(expResul, i, 1);
    }

  //3.2 Annual table (frequency of pixels by number of valid observations)
    
    var yearlySeq = ee.List.sequence(0,yTot,1); 
    
    //Numeric list to dates list
    var datesListYear = yearlySeq.map(dateGenYear);
    
    //Build monthly mosaics
    var meanFeatureColYear = datesListYear.map(yearFilter2);
    
    //Create an image collection from the annual mosaics
    var expImCollYear = ee.ImageCollection.fromImages(meanFeatureColYear);
    
    //Loop to export the monthly info as tables by ecoregion
    i = CVEinit;
    for(;i<=CVEfinit;i++){
      
      var featEcor = Ecor.filter(ee.Filter.eq('CVEECON1',i));
      //Calculate frequency of pixels by number of valid observations
      var expResul = expImCollYear.map(reduceRegionMeanWrap(12,featEcor));
  
      //Export
      exportMeansYear(expResul, i);
    
    }

//4 
//----------------Export images--------------------------------------
  //Export annual images in a loop
    var i = 0;
    for(;i<=yTot;i++){
      var currYear = mStart + i;
 
      var yearIm = expImCollYear.filter(ee.Filter.eq('Fecha',currYear.toString()+'-1-1'));

      yearIm = yearIm.first();
 
      yearIm = yearIm.select('julianDay_ValidObs');

      yearIm = yearIm.floor().toUint16();
    
      exportImageYear(yearIm,currYear,resolution);
    }

  //Export monthly images in a loop
  //Currently, only exports the monthly images of the year indicated in the first section
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
//-----------------Export metadata info----------------------
  var S2_1CMeta = Sentinel2_2A
      .filterDate(mStart.toString()+'-01-01',mEnd.toString()+'-12-31')
      .filterBounds(prueba)
      .select('QA60');
      
  var S2_1CExp = ee.FeatureCollection(S2_1CMeta.map(consulta));
  
  exportMetadata(S2_1CExp,mStart,mEnd);
