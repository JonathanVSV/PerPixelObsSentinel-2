# PerPixelObsSentinel-2

### English
Script made in the Google Earth Engine Javascript API that obtains the number of cloudless observations for a specific spatiotemporal window, using the Sentinel-2 level 1C collection. This code obtains the number of images available for a certain spatiotemporal windiw, the number of cloudless observations (pixel level) and the number of cloudless observations by ecoregion. In this script, duplicated observations from overlapping image tiles are counted only once. The ecoregions shapefile used in the script is provided as a zip, which is a dissolved polygon version of the original information available in the CONABIO website (http://www.conabio.gob.mx/informacion/gis/maps/geo/ecort08gw.zip).

### Español
Código diseñado en la API de Google Earth Engine basada en Javascript que obtiene el número de observaciones sin nubes para una ventana espaciotemporal determinada, utilizando el acervo Sentinel-2 nivel 1C. Este código permite obtener la información a nivel de imagen, a nivel de pixel y por ecorregión. El shapefile de las ecorregiones que se utiliza en la rutina está disponible como archivo zip, el cual consiste en una versión donde se disolvieron los polígonos de la información original disponible en el portal de la CONABIO (http://www.conabio.gob.mx/informacion/gis/maps/geo/ecort08gw.zip)
