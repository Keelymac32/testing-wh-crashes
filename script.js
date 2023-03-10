//Setting Up Map 
var map = L.map('map', {
    zoomControl: false,
    center: [41.761755, -72.765270],
    zoom: 13,
    minZoom: 12,
    attributionControl: false,
    preferCanvas: true
})

//Zoom Control 
L.control.zoom({ position: 'topright' }).addTo(map)

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map)

//Setting up Map Baselayer from supplied link 
var labels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
    pane: 'shadowPane'  // always display on top
}).addTo(map)

function dateToTS(date) {
    return date.valueOf();
}

function tsToDate(ts) {
    var d = new Date(ts);

    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// display initial data, where Jan = 0 and Dec = 11
var initFrom = dateToTS(new Date(2020, 0, 1));
var initTo = dateToTS(new Date(2023, 1, 8));

//function to look through data.csv that was created with jupyter script 
Papa.parse('./data/crashes.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    complete: function (result) {

        var data = result.data;
        //adding points to heat map 
        var heat = L.heatLayer([], { radius: 20 }).addTo(map);
        var individualPoints = L.layerGroup().addTo(map);

        var tsCoef = 100000.0 // original timestamp needs to be multiplied by this to work in JS
        
        //formatting text that displays how many crashes satify the specified the desired conditions
        var updateStatsText = function (formattedFrom, formattedTo, crashesTotal, crashesPed, crashesCyc, filtered) {
            var text = formattedFrom === formattedTo
                ? ('On ' + formattedFrom)
                : ('From ' + formattedFrom + ' to ' + formattedTo)

            text += ', there ' + (crashesTotal === 1 ? 'was ' : 'were ') + (crashesTotal === 0 ? 'no' : crashesTotal.toLocaleString())
            text += ' car crash' + (crashesTotal === 1 ? '' : 'es') + ' in West Hartford.'

            if (crashesTotal > 1) {
                text += ' Of those, ' + (crashesPed > 0 ? crashesPed.toLocaleString() : ' none');
                text += ' involved a pedestrian, and ';
                text += (crashesCyc > 0 ? crashesCyc.toLocaleString() : ' none');
                text += ' involved a cyclist.';
            }

            text += ' <span class="i ' + (filtered ? '' : 'red') + '">'
                + (filtered ? filtered.toLocaleString() : 'No ') + ' crash'
                + (filtered === 1 ? '' : 'es') + ' satisf' + (filtered === 1 ? 'ies' : 'y')
                + ' your filtering criteria.</span>'

            $('#statsText').html(text)

        }

        // Given `from` and `to` timestamps, updates the heatmap layer.
        var updateHeatLayer = function (from, to) {

            from = dateToTS(new Date(from * 1).setHours(0, 0, 0, 0)) / tsCoef;
            to = dateToTS(new Date(to * 1).setHours(23, 59, 59, 0)) / tsCoef;

            // All crashes between set dates
            var crashes = data.filter(function (point) {
                return point.d >= from && point.d <= to;
            })
            // Filtering results for types of routes and added them to map when button pressed  
            var crashesFiltered = crashes.filter(function (point) {
                return (($('#local').prop('checked') ? point.r === 4 : false)
                    || ($('#highways').prop('checked') ? point.r === 1 : false))
                    || ($('#usroute').prop('checked') ? point.r === 2 : false)
                    || ($('#state').prop('checked') ? point.r === 3 : false)
                    || ($('#unknown').prop('checked') ? point.r === 0 : false)
                    || ($('#unknown').prop('checked') ? point.r === nil : false)
            // Filtering results for people involved and adding them to map when button pressed
                    && (($('#vehiclesOnly').prop('checked') ? (point.c === 0 && point.p === 0) : false)
                        || ($('#cyclists').prop('checked') ? point.c === 1 : false)
                        || ($('#pedestrians').prop('checked') ? point.p === 1 : false))
            // Filtering results for major injury and adding them to map when button pressed
                    && (($('#propertyDamage').prop('checked') ? point.s === 'O' : false)
                        || ($('#seriousInjury').prop('checked') ? point.s === 'A' : false)
                        || ($('#minorInjury').prop('checked') ? point.s === 'B' : false)
                        || ($('#minorInjury').prop('checked') ? point.s === 'C' : false)
                        || ($('#fatal').prop('checked') ? point.s === 'K' : false))
            });

            updateStatsText(
                tsToDate(from * 100000),  // Date from
                tsToDate(to * 100000),  // Date to
                crashes.length, // Total crashes
                crashes.filter(function (p) { return p.p === 1 }).length,  // Ped crashes
                crashes.filter(function (p) { return p.c === 1 }).length,  // Cyc crashes
                crashesFiltered.length
            )

            // Despite zoom, clear individual points
            individualPoints.clearLayers();

            // Update the heatlayer
            var intensity = $('#intensity').val();

            // If zoomed in all the way, show points instead of a heatmap
            if (map.getZoom() >= 18) {

                heat.setLatLngs([]);

                crashesFiltered.map(function (crash) {
                    var diagramUrl = 'https://www.ctcrash.uconn.edu/MMUCCDiagram?id=' + crash.id + '&asImage=true'

                    var circle = L.circleMarker([crash.x, crash.y], {
                        radius: 5,
                        color: '#002147',
                        fillColor: '#002147',
                        fillOpacity: 0.8,
                        opacity: 0.8,
                        weight: 0,
                    }).bindPopup(
                    // Populating pop up for individual crash info
                        '<strong>Crash ID ' + crash.id + '</strong><br />'
                        + tsToDate(crash.d * tsCoef) + ' at ' + crash.t
                        + '<a href="' + diagramUrl + '" target="_blank"><img src="' + diagramUrl + '" alt="Crash diagram" /></a>'
                        + '<br />Injury Severity: ' + (crash.s === 'K' ? 'Fatal crash' : crash.s === 'A' ? 'Serious Injury' : crash.s === 'B' ? 'Minor Injury' : crash.s === 'C' ? 'Minor Injury' : 'Property damage only'),
                        { minWidth: 300 }
                    )

                    individualPoints.addLayer(circle);
                })

            }

            // Zoomed out enough for a heatmap
            else {
                heat.setLatLngs(
                    crashesFiltered.map(function (point) {
                        return [point.x, point.y, intensity / 3.0];
                    })
                )
            }

        }

        // Initialize Ion range slider
        var slider = $(".js-range-slider").ionRangeSlider({
            type: 'double',

            // set full range display, where 0 = Jan and 11 = Dec
            min: dateToTS(new Date(2015, 0, 1)),
            max: dateToTS(new Date(2023, 1, 8)),

            from: initFrom,
            to: initTo,

            prettify: tsToDate,
            grid: true,
            grid_num: 4,

            onChange: function (sliderData) {
                updateHeatLayer(sliderData.from, sliderData.to);
            }
        });


        // Re-draw heat layer when any filter (apart from street labels)
        // is changed
        $('#filters input').not('#labels').change(function (e) {
            updateHeatLayer(
                slider[0].value.split(';')[0],
                slider[0].value.split(';')[1]
            )
        })


        // Toggle street/town labels
        $('#labels').change(function (e) {
            if ($('#labels').prop('checked')) {
                labels.addTo(map);
            } else {
                map.removeLayer(labels);
            }
        })

        map.on('zoomend', function () {
            updateHeatLayer(
                slider[0].value.split(';')[0],
                slider[0].value.split(';')[1]
            )
        })

        // Set default properties
        $('#filters input').prop('checked', 'checked');
        $('#intensity').val(5);
        updateHeatLayer(initFrom, initTo);

    }
})

L.control.attribution({
    prefix: 'View <a href="https://github.com/bikewesthartford/wh-crashes">code on GitHub</a> \
      and <a href="https://github.com/Picturedigits/hartford-crashes">original version by PictureDigits</a>'
}).addTo(map)
