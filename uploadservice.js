'use strict';
angular.module('app')
app.factory('uploadService', ['$http', function ($http)
{
    var serviceFactory = {};

    var _getSPHostUrl = function ()
    {
        return $http.get('/api/Upload/GetSharePointHostUrl');
    };

    var _uploadBlock = function (fileChunk)
    {
        return $http.post("api/Upload/UploadBlock", fileChunk, {            
            transformRequest: angular.identity,
            headers: { 'Content-Type': undefined }
        });
    };
    
    var _initializeMetadata = function (uploadFileRequest)
    {
        return $http.post("api/Upload/InitializeMetadata", uploadFileRequest);
    };

    var _updateSharePoint = function (updateSharePointRequest)
    {
        return $http.post("api/Upload/UpdateSharePoint", updateSharePointRequest);
    };

    serviceFactory.getSPHostUrl = _getSPHostUrl;
    serviceFactory.uploadBlock = _uploadBlock;
    serviceFactory.initializeMetadata = _initializeMetadata;
    serviceFactory.updateSharePoint = _updateSharePoint;

    return serviceFactory;

}]);


