const http = require('follow-redirects').http;
const fs = require('fs');
const shapefile = require("shapefile");
const AdmZip = require('adm-zip');
const simplify = require('simplify-geojson');


const simplifyThreshold = 0; // // Simplify if geojson size is over this value in MB (0 to simplify all)
const simplifyTolerance = 0.01; // Higher is lighter (default 0.001)

const COUNTRY_CODES = ["AFG","XAD","ALA","ALB","DZA","ASM","AND","AGO","AIA","ATA","ATG","ARG","ARM","ABW","AUS","AUT","AZE","BHS","BHR","BGD","BRB","BLR","BEL","BLZ","BEN","BMU","BTN","BOL","BES","BIH","BWA","BVT","BRA","IOT","VGB","BRN","BGR","BFA","BDI","KHM","CMR","CAN","CPV","XCA","CYM","CAF","TCD","CHL","CHN","CXR","XCL","CCK","COL","COM","COK","CRI","CIV","HRV","CUB","CUW","CYP","CZE","COD","DNK","DJI","DMA","DOM","ECU","EGY","SLV","GNQ","ERI","EST","ETH","FLK","FRO","FJI","FIN","FRA","GUF","PYF","ATF","GAB","GMB","GEO","DEU","GHA","GIB","GRC","GRL","GRD","GLP","GUM","GTM","GGY","GIN","GNB","GUY","HTI","HMD","HND","HKG","HUN","ISL","IND","IDN","IRN","IRQ","IRL","IMN","ISR","ITA","JAM","JPN","JEY","JOR","KAZ","KEN","KIR","XKO","KWT","KGZ","LAO","LVA","LBN","LSO","LBR","LBY","LIE","LTU","LUX","MAC","MKD","MDG","MWI","MYS","MDV","MLI","MLT","MHL","MTQ","MRT","MUS","MYT","MEX","FSM","MDA","MCO","MNG","MNE","MSR","MAR","MOZ","MMR","NAM","NRU","NPL","NLD","NCL","NZL","NIC","NER","NGA","NIU","NFK","PRK","XNC","MNP","NOR","OMN","PAK","PLW","PSE","PAN","PNG","PRY","PER","PHL","PCN","POL","PRT","PRI","QAT","COG","REU","ROU","RUS","RWA","BLM","MAF","SHN","KNA","LCA","SPM","VCT","WSM","SMR","STP","SAU","SEN","SRB","SYC","SLE","SGP","SXM","SVK","SVN","SLB","SOM","ZAF","SGS","KOR","SSD","ESP","LKA","SDN","SUR","SJM","SWZ","SWE","CHE","SYR","TWN","TJK","TZA","THA","TLS","TGO","TKL","TON","TTO","TUN","TUR","TKM","TCA","TUV","UGA","UKR","ARE","GBR","USA","UMI","URY","UZB","VUT","VAT","VEN","VNM","VIR","WLF","ESH","YEM","ZMB","ZWE"];
const COUNTRY_CODES_ADM0 = ["ABW", "BVT", "IOT", "CXR", "XCA", "CCK", "CUW", "COK", "HMD", "GIB", "AIA", "MLT", "MCO", "MAF", "KIR", "MDV", "BLM", "VAT", "NFK", "SGS", "MHL", "SXM", "FLK", "ATA", "PCN", "NIU", "XCL"]; // Countries without ADM1
const BASE_URL = "http://biogeo.ucdavis.edu/data/gadm2.8/shp/";
const SUFFIX_URL = "_adm_shp.zip";

const directory = "./data/";
const downloadDirectory = directory + "downloads/";
const extractionDirectory = directory + "shapes/";
const geojsonDirectory = directory + "geojson/";

const log = (i, country, more) => console.log(`${i+1}/${COUNTRY_CODES.length} ${country} - ${more}`);

const convertPromises = COUNTRY_CODES.map((countryCode, i) => () => new Promise((resolve, reject) => {
	const url = BASE_URL + countryCode + SUFFIX_URL;
	const zipPath = downloadDirectory + countryCode + SUFFIX_URL;
	const admLevel = COUNTRY_CODES_ADM0.includes(countryCode) ? 0 : 1;
	const filename = countryCode + '_adm' + admLevel;

	const geojsonPath = geojsonDirectory + filename + '.geojson';

	const cb = () => {
		
		const zip = new AdmZip(zipPath);
		const zipEntries = zip.getEntries();
		for (const entry of zipEntries) {
			if (entry.entryName.startsWith(filename)) {
				zip.extractEntryTo(entry.entryName, extractionDirectory + countryCode, false, true);
			}
		}

		if (fs.existsSync(geojsonPath)) {
			log(i, countryCode, 'SKIPPED');
			return resolve();
		}

		shapefilePath = extractionDirectory + countryCode + '/' + filename + '.shp';
		shapefile.read(shapefilePath)
			.then(result => {

				const dataSize = Buffer.byteLength(JSON.stringify(result), 'utf8') / 1024 / 1024; // in MB
				if (dataSize > simplifyThreshold) {
					const resultSimplified = simplify(result, simplifyTolerance);

					dataSimplifiedSize = Buffer.byteLength(JSON.stringify(resultSimplified), 'utf8') / 1024 / 1024;
					console.log(`From: ${Math.round(dataSize * 100) / 100} MB -> To ${Math.round(dataSimplifiedSize * 100) / 100} MB`);

					result = resultSimplified;
				}

				fs.writeFile(geojsonPath, JSON.stringify(result), err => {
					if (err) {
						reject();
						log(i, countryCode, 'ERROR: ' + err);
					}

					log(i, countryCode, 'SUCCESS');					

					resolve();
				});
			})
			.catch(error => {
				console.error(error.stack);
				reject();
			});
	};

	const file = fs.createWriteStream(zipPath);
	var request = http.get(url, function(response) {
	  response.pipe(file);
	  file.on('finish', () => file.close(cb));
	});
}));

// Execute promises one after the other to avoid filling the RAM when reading shapefiles
convertPromises.reduce(
	(curr, next) => curr.then(next),
	Promise.resolve()
);