const http = require('follow-redirects').http;
const fs = require('fs');
const shapefile = require("shapefile");
const AdmZip = require('adm-zip');

const COUNTRY_CODES = ["AFG","XAD","ALA","ALB","DZA","ASM","AND","AGO","AIA","ATA","ATG","ARG","ARM","ABW","AUS","AUT","AZE","BHS","BHR","BGD","BRB","BLR","BEL","BLZ","BEN","BMU","BTN","BOL","BES","BIH","BWA","BVT","BRA","IOT","VGB","BRN","BGR","BFA","BDI","KHM","CMR","CAN","CPV","XCA","CYM","CAF","TCD","CHL","CHN","CXR","XCL","CCK","COL","COM","COK","CRI","CIV","HRV","CUB","CUW","CYP","CZE","COD","DNK","DJI","DMA","DOM","ECU","EGY","SLV","GNQ","ERI","EST","ETH","FLK","FRO","FJI","FIN","FRA","GUF","PYF","ATF","GAB","GMB","GEO","DEU","GHA","GIB","GRC","GRL","GRD","GLP","GUM","GTM","GGY","GIN","GNB","GUY","HTI","HMD","HND","HKG","HUN","ISL","IND","IDN","IRN","IRQ","IRL","IMN","ISR","ITA","JAM","JPN","JEY","JOR","KAZ","KEN","KIR","XKO","KWT","KGZ","LAO","LVA","LBN","LSO","LBR","LBY","LIE","LTU","LUX","MAC","MKD","MDG","MWI","MYS","MDV","MLI","MLT","MHL","MTQ","MRT","MUS","MYT","MEX","FSM","MDA","MCO","MNG","MNE","MSR","MAR","MOZ","MMR","NAM","NRU","NPL","NLD","NCL","NZL","NIC","NER","NGA","NIU","NFK","PRK","XNC","MNP","NOR","OMN","PAK","PLW","PSE","PAN","PNG","PRY","PER","PHL","PCN","POL","PRT","PRI","QAT","COG","REU","ROU","RUS","RWA","BLM","MAF","SHN","KNA","LCA","SPM","VCT","WSM","SMR","STP","SAU","SEN","SRB","SYC","SLE","SGP","SXM","SVK","SVN","SLB","SOM","ZAF","SGS","KOR","SSD","ESP","LKA","SDN","SUR","SJM","SWZ","SWE","CHE","SYR","TWN","TJK","TZA","THA","TLS","TGO","TKL","TON","TTO","TUN","TUR","TKM","TCA","TUV","UGA","UKR","ARE","GBR","USA","UMI","URY","UZB","VUT","VAT","VEN","VNM","VIR","WLF","ESH","YEM","ZMB","ZWE"];
const COUNTRY_CODES_ADM0 = ["ABW", "BVT", "IOT", "CXR", "XCA", "CCK", "CUW", "COK", "HMD", "GIB", "AIA", "MLT", "MCO", "MAF", "KIR", "MDV", "BLM", "VAT", "NFK", "SGS", "MHL", "SXM", "FLK", "ATA", "PCN", "NIU", "XCL"]; // Countries without ADM1
const BASE_URL = "http://biogeo.ucdavis.edu/data/gadm2.8/shp/";
const SUFFIX_URL = "_adm_shp.zip";

const directory = "./data/";
const downloadDirectory = directory + "downloads/";
const extractionDirectory = directory + "shapes/";
const geojsonDirectory = directory + "geojson/";


const convertPromises = COUNTRY_CODES.map((countryCode, i) => () => new Promise((resolve, reject) => {
	const url = BASE_URL + countryCode + SUFFIX_URL;
	const zipPath = downloadDirectory + countryCode + SUFFIX_URL;

	const cb = () => {
		const admLevel = COUNTRY_CODES_ADM0.includes(countryCode) ? 0 : 1;
		const filename = countryCode + '_adm' + admLevel;

		const zip = new AdmZip(zipPath);
		const zipEntries = zip.getEntries();
		for (const entry of zipEntries) {
			if (entry.entryName.startsWith(filename)) {
				zip.extractEntryTo(entry.entryName, extractionDirectory + countryCode, false, true);
			}
		}

		if (fs.existsSync(geojsonDirectory + filename + '.geojson')) {
			console.log((i + 1) + '/' + COUNTRY_CODES.length + ' - SKIPPED');
			resolve();
			return;
		}

		shapefilePath = extractionDirectory + countryCode + '/' + filename + '.shp';
		shapefile.read(shapefilePath)
			.then(result => {
				fs.writeFile(geojsonDirectory + filename + '.geojson', JSON.stringify(result), err => {
					if (err) {
						reject();
						return console.log((i + 1) + '/' + COUNTRY_CODES.length + ' - ERROR: ' + err);
					}
					console.log((i + 1) + '/' + COUNTRY_CODES.length + ' - SUCCESS');
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

convertPromises.reduce((curr, next) => curr.then(next), Promise.resolve())