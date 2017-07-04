'use strict';

const angular = require('angular');
const moment = require('moment');
const XLSX = require('xlsx');
const DOCXtemplater = require('docxtemplater');
const FileSaver = require('file-saver');
const JSZip = require('jszip');
const JSZipUtils = require('jszip-utils');

const myApp = angular.module("myApp", []);

// Support functions

function datenum(v, date1904) {
  if(date1904) v+=1462;
  var epoch = Date.parse(v);
  return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
}

function sheet_from_array_of_arrays(data, opts) {
  let ws = {};
  let range = {s: {c:10000000, r:10000000}, e: {c:0, r:0 }};
  for(let R = 0; R != data.length; ++R) {
    for(let C = 0; C != data[R].length; ++C) {
      if(range.s.r > R) range.s.r = R;
      if(range.s.c > C) range.s.c = C;
      if(range.e.r < R) range.e.r = R;
      if(range.e.c < C) range.e.c = C;
      let cell = {v: data[R][C] };
      if(cell.v == null) continue;
      let cell_ref = XLSX.utils.encode_cell({c:C,r:R});

      if(typeof cell.v === 'number') cell.t = 'n';
      else if(typeof cell.v === 'boolean') cell.t = 'b';
      else if(cell.v instanceof Date) {
        cell.t = 'n'; cell.z = XLSX.SSF._table[14];
        cell.v = datenum(cell.v);
      }
      else cell.t = 's';

      ws[cell_ref] = cell;
    }
  }
  if(range.s.c < 10000000) ws['!ref'] = XLSX.utils.encode_range(range);
  return ws;
}

function s2ab(s) {
  var buf = new ArrayBuffer(s.length);
  var view = new Uint8Array(buf);
  for (var i=0; i!=s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
  return buf;
}

function loadFile(url,callback) {
  JSZipUtils.getBinaryContent(url,function(err,data){
    callback(null,data);
  });
}

// ########################################################################
// My App

(function(app){
  //'use strict';
  app.controller('myController', function($scope){
    $scope.attendees = [];
    $scope.apologies = [];
    $scope.minutes = [];
    $scope.minuteName = 'n/a';
    $scope.minuteType = 'n/a';

    $scope.updateMinuteName = function() {
      // Fix due to the addition of radios
      $scope.minuteName = this.minuteName;
    };

    $scope.addAttendee = function() {
      if (!$scope.attendees.includes($scope.attendeesName)) {
        $scope.attendees.push($scope.attendeesName);
      }
      $scope.attendeesName = "";
    };

    $scope.removeAttendee = function(idx) {
      $scope.attendees.splice(idx, 1);
    };

    $scope.addApology = function() {
      if (!$scope.apologies.includes($scope.apologiesName)) {
        $scope.apologies.push($scope.apologiesName);
      }
      $scope.apologiesName = "";
    };

    $scope.removeApology = function(idx) {
      $scope.apologies.splice(idx, 1);
    };

    $scope.addMinute = function() {
      $scope.minutes.push({
        date: moment(new Date()).format('MMMM Do YYYY, h:mm:ss a'),
        name: $scope.minuteName,
        type: $scope.minuteType,
        minute: $scope.minuteText
      });
      $scope.minuteText = "";
    };

    $scope.downloadXLSX = function() {

      // Create new workbook model
      let workbook = {
        SheetNames: [],
        Sheets: {}
      };

      // Create Meeting Info Worksheet
      let meetingInfoWorkSheetName = "Meeting Information";
      let meetingInfoData = [
        ['Title', $scope.title],
        ['Download Date', moment().format('MMMM Do YYYY, h:mm:ss a')],
      ];
      let attendees = ['Attendees'];
      for (let n of $scope.attendees) {
        attendees.push(n);
      }
      meetingInfoData.push(attendees);
      let apologies = ['Apologies'];
      for (let n of $scope.apologies) {
        apologies.push(n);
      }
      meetingInfoData.push(apologies);
      // Convert array of arrays into the worksheet data
      let meetingInfoWorkSheet = sheet_from_array_of_arrays(meetingInfoData);

      // Create Minutes Worksheet
      let minutesWorkSheetName = "Minutes";
      let minutesData = [['Date','Name','Type','Comment']];
      for (let minute of $scope.minutes) {
        minutesData.push([
          minute.date,
          minute.name,
          minute.type,
          minute.minute
        ]);
      }
      // Convert array of arrays into the worksheet data
      let minutesWorkSheet = sheet_from_array_of_arrays(minutesData);

      // Add sheets to the workbook model
      workbook.SheetNames.push(meetingInfoWorkSheetName);
      workbook.SheetNames.push(minutesWorkSheetName);
      workbook.Sheets[meetingInfoWorkSheetName] = meetingInfoWorkSheet;
      workbook.Sheets[minutesWorkSheetName] = minutesWorkSheet;

      // Write out the workbook in xlsx form
      var wbout = XLSX.write(workbook, {bookType:'xlsx', bookSST:true, type: 'binary'});

      // Save out as a download
      FileSaver.saveAs(new Blob([s2ab(wbout)],{type:"application/octet-stream"}), "minutes.xlsx");

    };

    $scope.downloadDOCX = function() {

      loadFile('minutes.docx', function(err, content) {

        let minutesData = [];
        for (let minute of $scope.minutes) {
          minutesData.push({
            date: minute.date,
            name: minute.name,
            type: minute.type,
            comment: minute.minute
          });
        }

        let zip = new JSZip(content);
        let doc = new DOCXtemplater().loadZip(zip);
        doc.setData({
          title :"My Meeting",
          date : moment().format('MMMM Do YYYY, h:mm:ss a'),
          attendees : $scope.attendees.join(', '),
          apologies : $scope.apologies.join(', '),
          minutes : minutesData
        }); // set the templateVariables
        doc.render(); // apply them (replace all occurences of {first_name} by Hipp, ...)
        let out = doc.getZip().generate({type:'blob'}); // utput the document using Data-URI
        FileSaver.saveAs(out, 'minutes.docx');

      });

    };

  });

})(myApp);
