'use strict';
angular.module('app')
app.controller('uploadController', ['$scope', '$rootScope', 'uploadService', function ($scope, $rootScope, uploadService)
{
    $scope.statusMsg = '';
    $scope.loadingMsg = 'Loading...';
    
    $scope.spListUrl = '';
    $scope.downloadUrl = '';

    $scope.uploadInProgress = false;
    $scope.percentCompleted = 0;        
    
    $scope.file = '';
    $scope.maxBlockLength = 1024 * 1024;
    $scope.start = 0;
    $scope.end = 0;

    $scope.maxRetries = 3;
    $scope.retryCount = 0;

    $scope.metadata = {
        'fileName': '',
        'fileSize': 0,
        'blockCount': 1048576,
        'blockID': 1,
        'spHostUrl': ''
    };

    $scope.updateStatus = function (status)
    {
        var elem = document.getElementById("statusMsg");
        elem.innerText = status;

    };

    $scope.uploadFile = function ()
    {
        var maxBlockLength = 1048576;   //1024 * 1024

        $scope.file = document.getElementById("myFile").files[0];
        if ($scope.file != null)
        {
            $scope.startUpload();
            uploadService.getSPHostUrl().success(function (data)
            {


                $scope.initMetadata($scope.file, maxBlockLength, data.SPHostUrl);
                uploadService.initializeMetadata($scope.metadata).success(function (resp)
                {
                    $scope.metadata.fileName = resp.serverFileName;
                    $scope.end = Math.min(maxBlockLength, $scope.file.size);
                    $scope.sendNextChunk();
                }).error(function (err)
                {
                    $scope.updateStatus(err.Message);
                    $scope.cancelUpload();
                });

            }).error(function (err)
            {
                $scope.updateStatus(err.Message);
                $scope.cancelUpload();

            });
        }
        else
        {
            $scope.updateStatus("Invalid file chosen.  Please choose a file.");
        }
    };

    $scope.initMetadata = function (file, maxBlockLength, spHostUrl)
    {
        var blockCount = Math.ceil(file.size / maxBlockLength);
        $scope.metadata = {
            'fileName': file.name.toLowerCase(),
            'fileSize': file.size,
            'blockCount': blockCount,
            'blockID': 1,
            'spHostUrl': spHostUrl
        };
    };

    //Calculate progress
    $scope.renderProgress = function (blocksCompleted)
    {
        $scope.percentCompleted = Math.floor((blocksCompleted - 1) * 100 / $scope.metadata.blockCount);
        document.getElementById("uploadProgress").removeAttribute("hidden");
        document.getElementById("uploadProgress").setAttribute("value", $scope.percentCompleted);
        document.getElementById("uploadProgressText").innerText = $scope.percentCompleted + "%";
    };

    $scope.updateLinks = function ()
    {
        document.getElementById("spListUrlDiv").innerHTML = "<p><a href='" + $scope.spListUrl + "'>View the SharePoint list</a>";
        document.getElementById("downloadUrlDiv").innerHTML = "<p><a href='" + $scope.downloadUrl + "'>Click to download the item</a>";        
    };

    $scope.startUpload = function ()
    {
        document.getElementById("statusMsg").innerText = "";
        document.getElementById("spListUrlDiv").innerHTML = "";
        document.getElementById("downloadUrlDiv").innerHTML = "";
        document.getElementById("uploadProgress").setAttribute("hidden", "hidden");
        document.getElementById("uploadButton").disabled = true;
        document.getElementById("myFile").disabled = true;        
        document.getElementById("cancelButton").disabled = false;
    };

    $scope.stopUpload = function ()
    {             
        document.getElementById("uploadButton").disabled = true;
        document.getElementById("cancelButton").disabled = true;
        //Need to go back to SharePoint at this point to refresh the session
        document.getElementById("myFile").disabled = true;
    };

    $scope.cancelUpload = function ()
    {
        document.getElementById("spListUrlDiv").innerHTML = "";
        document.getElementById("downloadUrlDiv").innerHTML = "";
        document.getElementById("uploadProgress").setAttribute("hidden", "hidden");
        document.getElementById("uploadButton").disabled = true;
        document.getElementById("cancelButton").disabled = false;
        //Need to go back to SharePoint at this point to refresh the session
        document.getElementById("myFile").disabled = true;
    };

    //Update SharePoint with link to download
    $scope.updateSharePoint = function (fileName, fileSize, downloadUrl)
    {
        var updateSharePointRequest = {
            'fileName': fileName,
            'fileSize': fileSize,
            'downloadUrl': downloadUrl
        };

        uploadService.updateSharePoint(updateSharePointRequest).success(function (results)
        {
            $scope.spListUrl = results.ListUrl;
            $scope.downloadUrl = downloadUrl;
            $scope.updateStatus("Upload complete!");
            $scope.updateLinks();
            $scope.stopUpload();

        }).error(function (err)
        {
            if ($scope.retryCount < $scope.maxRetries)
            {
                ++$scope.retryCount;
                //retry after 5 seconds
                $scope.updateStatus("Retrying... " + errorMessage);
                setTimeout($scope.UpdateSharePoint(fileName, fileSize, downloadUrl), 5 * 1000);
            }
            else
            {
                $scope.updateStatus(err.Message);
                $scope.cancelUpload();
            }            
        })
    };

    
    //Send a chunk of data
    $scope.sendNextChunk = function ()
    {
        var fileChunk = new FormData();

        //Append the file metadata
        var metadata = JSON.stringify($scope.metadata);
        fileChunk.append("uploadFileMetadata", metadata);
        $scope.renderProgress($scope.metadata.blockID);

        //This is not the file
        
        if ($scope.file.slice)
        {
            fileChunk.append('Slice', $scope.file.slice($scope.start, $scope.end));
        }
        else if ($scope.file.webkitSlice)
        {
            fileChunk.append('Slice', $scope.file.webkitSlice($scope.start, $scope.end));
        }
        else if ($scope.file.mozSlice)
        {
            fileChunk.append('Slice', $scope.file.mozSlice($scope.start, $scope.end));
        }
        else
        {
            //Tell the caller this is an unsupported browser            
            $scope.updateStatus('This browser does not support the HTML5 File API.');
            $scope.cancelUpload();
            return;
        }

        uploadService.uploadBlock(fileChunk).success(function (data)
        {
            if (data.isUploadComplete)
            {
                //This is the last block
                $scope.renderProgress(data.blocksCount + 1);

                $scope.retryCount = 0;
                $scope.updateSharePoint(data.fileName, data.fileSize, data.downloadUrl)                
                return;
            }
            else
            {
                ++$scope.metadata.blockID;
                $scope.start = ($scope.metadata.blockID - 1) * $scope.maxBlockLength;
                $scope.end = Math.min($scope.metadata.blockID * $scope.maxBlockLength, $scope.file.size);
                $scope.retryCount = 0;
                $scope.sendNextChunk();
            }
        }).error(function (oops)
        {            
            if ($scope.retryCount < $scope.maxRetries)
            {
                ++$scope.retryCount;
                //retry after 5 seconds
                
                $scope.updateStatus("Retrying... " + oops.Message);
                
                setTimeout($scope.sendNextChunk, 5 * 1000);
            }
            else
            {
                $scope.updateStatus("Failed to upload:" + oops.Message);
                $scope.cancelUpload();
            }

        });
    }

}]);