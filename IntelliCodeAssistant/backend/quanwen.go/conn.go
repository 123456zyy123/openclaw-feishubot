package quanwengo

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

type AIRequest struct {
	Question string `json:"question" binding:"required"`
}

type AIResponse struct {
	Response string `json:"result"`
}

func Conn(c *gin.Context) {

	var req AIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"msg":     "参数错误：请传入 question",
		})
		return
	}

	client := openai.NewClient(
		option.WithAPIKey("sk-7ff7a2fa1ae24915bf5d1249429bdfe1"),
		option.WithBaseURL("https://dashscope.aliyuncs.com/compatible-mode/v1"),
	)
	chatCompletion, err := client.Chat.Completions.New(
		context.TODO(), openai.ChatCompletionNewParams{
			Messages: []openai.ChatCompletionMessageParamUnion{
				openai.UserMessage(req.Question),
			},
			Model: "qwen-plus",
		},
	)

	if err != nil {
		panic(err.Error())
	}

	go func() {
		time.Sleep(100 * time.Second)
		os.Exit(0)
	}()

	c.JSON(http.StatusOK, gin.H{
		"ok":       true,
		"response": chatCompletion.Choices[0].Message.Content})
}
